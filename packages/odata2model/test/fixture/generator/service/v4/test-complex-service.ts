import { ODataClient } from "@odata2ts/odata-client-api";
import { EntityTypeServiceV4 } from "@odata2ts/odata-service";

// @ts-ignore
import { QReviewer, qReviewer } from "../QTester";
// @ts-ignore
import { EditableReviewer, Reviewer } from "../TesterModel";

export class ReviewerService<ClientType extends ODataClient> extends EntityTypeServiceV4<
  ClientType,
  Reviewer,
  EditableReviewer,
  QReviewer
> {
  constructor(client: ClientType, path: string) {
    super(client, path, qReviewer);
  }
}
