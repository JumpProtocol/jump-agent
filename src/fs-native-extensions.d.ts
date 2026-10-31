declare module 'fs-native-extensions' {
  const extensions: { tryLock(fd: number): boolean };
  export default extensions;
}
