declare module 'better-sqlite3' {
  interface Statement {
    run(...params: unknown[]): unknown
    all(...params: unknown[]): unknown[]
    get(...params: unknown[]): unknown
  }

  interface DatabaseConnection {
    exec(source: string): void
    prepare(source: string): Statement
    close(): void
  }

  interface DatabaseConstructor {
    new (filename: string): DatabaseConnection
    (filename: string): DatabaseConnection
  }

  const Database: DatabaseConstructor
  export default Database
}
