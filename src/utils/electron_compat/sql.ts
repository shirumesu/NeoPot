class ElectronCompatDatabase {
  static async load(_url: string) {
    return new ElectronCompatDatabase()
  }

  async select() {
    return []
  }

  async execute() {
    return { rowsAffected: 0 }
  }

  async close() {}
}

export default ElectronCompatDatabase
