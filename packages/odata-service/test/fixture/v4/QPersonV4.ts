import {
  QCollectionPath, QEntityCollectionPath, QEntityPath,
  QEnumCollection,
  QEnumPath, QFunction,
  QNumberPath, QParam, QStringParam,
  QStringPath,
  QueryObject
} from "@odata2ts/odata-query-objects";
import {PersonId} from "../PersonModel";

export class QPersonV4 extends QueryObject {
  public readonly userName = new QStringPath(this.withPrefix("UserName"));
  public readonly age = new QNumberPath(this.withPrefix("Age"));
  public readonly favFeature = new QEnumPath(this.withPrefix("FavFeature"));
  public readonly features = new QCollectionPath(this.withPrefix("Features"), () => QEnumCollection);
  public readonly friends = new QEntityCollectionPath(this.withPrefix("Friends"), () => QPersonV4);
  public readonly bestFriend = new QEntityPath(this.withPrefix("BestFriend"), () => QPersonV4);

  constructor(path?: string) {
    super(path);
  }
}

export const qPersonV4 = new QPersonV4();
