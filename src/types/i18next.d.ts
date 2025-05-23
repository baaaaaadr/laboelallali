import 'i18next';

declare module 'i18next' {
  interface CustomTypeOptions {
    // Overriding DefaultTFuncReturn to string helps with 'Type instantiation is excessively deep'.
    DefaultTFuncReturn: string;

    // Simplifying Resources further reduces type complexity.
    // This tells TypeScript that all keys within the 'common' namespace return strings.
    Resources: {
      common: {
        [key: string]: string; // Define all keys in 'common' as string -> string
      };
      // If you use other namespaces and encounter similar issues,
      // you can define them here too, e.g.:
      // otherNamespace: {
      //   [key: string]: string;
      // };
    };
  }
}
