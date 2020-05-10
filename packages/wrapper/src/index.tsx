import * as React from 'react';
import {Action, AnyAction, Store} from 'redux';
import {NextComponentType, NextPageContext} from 'next';
import {AppProps} from 'next/app';
import {NextRouter} from 'next/dist/next-server/lib/router/router';
import {AppTreeType} from 'next/dist/next-server/lib/utils';
import {Router} from 'next/dist/client/router';

const defaultConfig = {
    storeKey: '__NEXT_REDUX_STORE__',
    debug: false,
    serializeState: (state: any) => state,
    deserializeState: (state: any) => state,
};

const withRedux = <S extends any = any, A extends Action = AnyAction>(makeStore: MakeStore<S, A>, config?: Config) => {
    const defaultedConfig = {
        ...defaultConfig,
        ...config,
    };

    const isServer = typeof window === 'undefined';

    const initStore = ({initialState, ctx}: InitStoreOptions<S, A>): Store<S, A> => {
        const {storeKey} = defaultedConfig;

        const createStore = () =>
            makeStore(defaultedConfig.deserializeState(initialState), {
                ...ctx,
                ...config,
                isServer,
            });

        if (isServer) return createStore();

        // Memoize store if client
        if (!(storeKey in window)) {
            (window as any)[storeKey] = createStore();
        }

        return (window as any)[storeKey];
    };

    return (App: NextComponentType | any) =>
        class WrappedApp extends React.Component<WrappedAppProps> {
            /* istanbul ignore next */
            public static displayName = `withRedux(${App.displayName || App.name || 'App'})`;

            public static getInitialProps = async (appCtx: ExtendedAppContext<S, A>) => {
                /* istanbul ignore next */
                if (!appCtx) throw new Error('No app context');
                /* istanbul ignore next */
                if (!appCtx.ctx) throw new Error('No page context');

                const store = initStore({
                    ctx: appCtx.ctx,
                });

                if (defaultedConfig.debug)
                    console.log('1. WrappedApp.getInitialProps wrapper got the store with state', store.getState());

                appCtx.ctx.store = store;
                appCtx.ctx.isServer = isServer;

                let initialProps = {};

                if ('getInitialProps' in App) {
                    initialProps = await App.getInitialProps.call(App, appCtx);
                }

                if (defaultedConfig.debug)
                    console.log('3. WrappedApp.getInitialProps has store state', store.getState());

                return {
                    isServer,
                    initialState: isServer ? defaultedConfig.serializeState(store.getState()) : store.getState(),
                    initialProps,
                };
            };

            public constructor(props: WrappedAppProps, context: ExtendedAppContext<S, A>) {
                super(props, context);

                const {initialState} = props;

                if (defaultedConfig.debug)
                    console.log('4. WrappedApp.render created new store with initialState', initialState);

                this.store = initStore({
                    ctx: context.ctx,
                    initialState,
                });
            }

            readonly store: Store<S, A>;

            public render() {
                const {initialProps, initialState, ...props} = this.props;

                // Cmp render must return something like <Provider><Component/></Provider>
                return <App {...props} {...initialProps} store={this.store} />;
            }
        };
};

export default withRedux;

export interface Config {
    serializeState?: (state: any) => any;
    deserializeState?: (state: any) => any;
    storeKey?: string;
    debug?: boolean;
    overrideIsServer?: boolean;
}

export type MakeStoreOptions<S = any, A extends Action = AnyAction> = Config & NextPageContext<S, A>;

export declare type MakeStore<S = any, A extends Action = AnyAction> = (
    initialState: S,
    options: MakeStoreOptions<S, A>,
) => Store<S, A>;

export interface InitStoreOptions<S extends any = any, A extends Action = AnyAction> {
    initialState?: S;
    ctx: NextPageContext<S, A>;
}

export interface WrappedAppProps {
    initialProps: any; // stuff returned from getInitialProps
    initialState: any; // stuff in the Store state after getInitialProps
    isServer: boolean;
}

/**
 * Convenience type that adds the Redux store provided by `next-redux-wrapper` to the props of a
 * wrapped `App` component.
 *
 * Usage example (within `_app.js`):
 * ```
 * class MyApp extends App<ReduxWrappedAppProps> {
 * ```
 * or, if you want to provide custom state and action types for the store:
 * ```
 * class MyApp extends App<ReduxWrappedAppProps<MyStateType, MyActionType>> {
 * ```
 *
 * You can also add custom `App` props via the third type argument.
 */
export interface ReduxWrapperAppProps<S = any, A extends Action = AnyAction, P = {}> extends AppProps<P> {
    store: Store<S, A>;
}

export type ExtendedAppContextType<R extends NextRouter = NextRouter, S = any, A extends Action = AnyAction> = {
    Component: NextComponentType<NextPageContext<S, A>>;
    AppTree: AppTreeType;
    ctx: NextPageContext<S, A>;
    router: R;
};

export type ExtendedAppContext<S = any, A extends Action = AnyAction> = ExtendedAppContextType<Router, S, A>;

declare module 'next/dist/next-server/lib/utils' {
    export interface NextPageContext<S = any, A extends Action = AnyAction> {
        /**
         * Provided by next-redux-wrapper: Whether the code is executed on the server or the client side
         */
        isServer: boolean;

        /**
         * Provided by next-redux-wrapper: The redux store
         */
        store: Store<S, A>;
    }
}
