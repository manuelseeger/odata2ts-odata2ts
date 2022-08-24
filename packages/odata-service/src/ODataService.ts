import { ODataClient } from "@odata2ts/odata-client-api";

export class ODataService {
  constructor(protected client: ODataClient, protected basePath: string) {
    if (!client) {
      throw new Error("[client] must be supplied to ODataService!");
    }
    if (!basePath || !basePath.trim()) {
      throw new Error("[basePath] must be supplied to ODataService!");
    }
  }

  public getPath(): string {
    return this.basePath;
  }
}
