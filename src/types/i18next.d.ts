import 'i18next';

declare module 'i18next' {
  interface CustomTypeOptions {
    // Overriding DefaultTFuncReturn to string helps with 'Type instantiation is excessively deep'.
    DefaultTFuncReturn: string;

    // Simplifying Resources further reduces type complexity.
    // This tells TypeScript that all keys within namespaces return strings.
    Resources: {
      common: {
        [key: string]: string;
      };
      appointment: {
        [key: string]: string;
      };
      catalog: {
        [key: string]: string;
      };
      glabo: {
        [key: string]: string;
      };
    };
  }
}
