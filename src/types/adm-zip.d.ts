declare module 'adm-zip' {
    interface ZipEntry {
        entryName: string;
        isDirectory: boolean;
        getData(): Buffer;
    }

    export default class AdmZip {
        constructor(path: string);
        getEntries(): ZipEntry[];
    }
}
