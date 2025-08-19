import * as CSS from 'csstype';

declare module 'csstype' {
  interface Properties {
    WebkitAppRegion?: 'drag' | 'no-drag';
    appRegion?: 'drag' | 'no-drag';
  }
}