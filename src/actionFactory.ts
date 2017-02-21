import * as s from './store';
import * as d from './debug';

let render: (() => void) | null = null;

export let bootstrap = (renderCallback: (() => void) | null) => {
    render = renderCallback;
    queueOfHandlers = [];
    d.log('Action factory has been initialized.');
};

export interface IAction<T> {
    (param?: T): void;
}

export type IActionHandler<TState extends s.IState, TParams> = (state: TState, t?: TParams) => TState;

export const createAction = <TState extends s.IState, TParams>(cursor: s.ICursor<TState> | s.ICursorFactory<TState, TParams>, handler: IActionHandler<TState, TParams>)
    : IAction<TParams> => {
    return <IAction<TParams>>((params?: TParams): void => {
        if (render === null)
            throw 'Render callback must be set before first usage through bootstrap(defaultState, () => { yourRenderCallback(); }).';

        if (changeStateWithQueue(unifyCursor<TState, TParams>(cursor, params), handler, params)) {
            render();
            d.log('Rendering invoked...');
        }
    });
}

function unifyCursor<TState extends s.IState, TParams>(cursor: s.ICursor<TState> | s.ICursorFactory<TState, TParams>, params: TParams | undefined): s.ICursor<TState> {
    return (<s.ICursorFactory<TState, TParams>>cursor).create instanceof Function ? (<s.ICursorFactory<TState, TParams>>cursor).create(params) : <s.ICursor<TState>>cursor;
}

export interface IPair<TState extends s.IState, TParam> {
    cursor: s.ICursor<TState>;
    handler: (state: TState, t?: TParam) => TState
}

export const createActions = <TState extends s.IState, TParams>(...pairs: IPair<TState, TParams>[]) => {
    return <IAction<TParams>>((params?: TParams) => {
        if (render === null)
            throw 'Render callback must be set before first usage through bootstrap(defaultState, () => { yourRenderCallback(); }).';
        let changed = false;
        for (var i in pairs)
            if (pairs.hasOwnProperty(i)) {
                let pair = pairs[i];
                if (changeStateWithQueue(pair.cursor, pair.handler, params))
                    changed = true;
            }
        changed && render();
    });
}

interface IQueuedHandling<TState extends s.IState, TParams> {
    cursor: s.ICursor<TState>;
    handler: IActionHandler<TState, TParams>;
    params: TParams;
}

let queueOfHandlers: IQueuedHandling<s.IState, Object>[] = [];
function changeStateWithQueue<TState extends s.IState, TParams>(cursor: s.ICursor<TState>, handler: IActionHandler<TState, TParams>, params: TParams)
    : boolean {
    queueOfHandlers.push({ cursor, handler, params });
    if (queueOfHandlers.length > 1)
        return false;
    let isStateChanged = false;
    while (queueOfHandlers.length > 0) {
        let n = queueOfHandlers[0];
        isStateChanged = changeState(n.cursor, n.handler, n.params) || isStateChanged;
        queueOfHandlers.shift();
    }
    isStateChanged && d.log('Global state has been changed.');
    return isStateChanged;
}

function changeState<TState extends s.IState, TParams>(cursor: s.ICursor<TState>, handler: IActionHandler<TState, TParams>, params: TParams)
    : boolean {
    let oldState = s.getState(cursor);
    let newState = handler(oldState, params);
    if (oldState === newState)
        return false;
    s.setState(cursor, newState);
    return true;
}