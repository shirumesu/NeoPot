class BrowserSmokeDatabase {
    static async load() {
        return new BrowserSmokeDatabase();
    }

    async select() {
        return [];
    }

    async execute() {
        return { rowsAffected: 0, lastInsertId: 0 };
    }

    async close() {}
}

export default BrowserSmokeDatabase;
