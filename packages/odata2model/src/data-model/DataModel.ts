import { upperCaseFirst } from "upper-case-first";
import { firstCharLowerCase } from "xml2js/lib/processors";

import { RunOptions } from "../app";
import {
  Property,
  NavigationProperty,
  Schema,
  OdataTypes,
  Action,
  Function,
  EntityContainer,
} from "../odata/ODataEdmxModel";
import {
  ModelType,
  EnumType,
  DataTypes,
  PropertyModel,
  EntityContainerModel,
  OperationType,
  OperationTypes,
} from "./DataTypeModel";

const EDM_PREFIX = "Edm.";
const ROOT_OPERATION = "/";
/**
 * EntityType, ComplexType, EnumType, PrimitiveType
 */
// export interface DataModel {}

export class DataModel {
  private serviceName: string;
  private servicePrefix: string;

  // combines entity & complex types
  private modelTypes: { [name: string]: ModelType } = {};
  private enumTypes: { [name: string]: EnumType } = {};
  // combines functions & actions
  private operationTypes: { [binding: string]: Array<OperationType> } = {};
  private container: EntityContainerModel = { entitySets: {}, singletons: {}, functions: {}, actions: {} };

  // imports of custom dataTypes which are represented at strings,
  // e.g. DateString, GuidString, etc.
  private primitiveTypeImports: Set<string> = new Set();

  constructor(schema: Schema, private options: RunOptions) {
    this.serviceName = schema.$.Namespace;
    this.servicePrefix = this.serviceName + ".";

    this.digestSchema(schema);
  }

  private getModelName(name: string) {
    return `${this.options.modelPrefix}${upperCaseFirst(this.stripServicePrefix(name))}${this.options.modelSuffix}`;
  }

  private getEnumName(name: string) {
    return `${upperCaseFirst(name)}`;
  }

  private getOperationName(name: string) {
    return firstCharLowerCase(this.stripServicePrefix(name));
  }

  private getEntryPointName(name: string) {
    return firstCharLowerCase(name);
  }

  private stripServicePrefix(token: string) {
    return token.replace(new RegExp(this.servicePrefix), "");
  }

  private digestSchema(schema: Schema) {
    // enums
    schema.EnumType?.forEach((et) => {
      const name = et.$.Name;
      this.enumTypes[name] = {
        odataName: name,
        name: this.getEnumName(name),
        members: et.Member.map((m) => m.$.Name),
      };
    });

    // entity types & complex types
    const models = [...(schema.EntityType ?? []), ...(schema.ComplexType ?? [])];
    models.forEach((model) => {
      const name = this.getModelName(model.$.Name);
      const bType = model.$.BaseType;
      const props = [...(model.Property ?? []), ...(model.NavigationProperty ?? [])];

      // support for base types, i.e. extends clause of interfaces
      const baseTypes = [];
      if (bType) {
        baseTypes.push(this.getModelName(bType));
      }

      this.modelTypes[name] = {
        odataName: model.$.Name,
        name: name,
        baseClasses: baseTypes,
        props: props.map(this.mapProperty),
      };
    });

    // functions, actions, EntitySet, Singleton
    this.addOperations(schema.Function, OperationTypes.Function);
    this.addOperations(schema.Action, OperationTypes.Action);
    this.digestEntityContainer(schema.EntityContainer[0]);
  }

  private mapProperty = (p: Property | NavigationProperty): PropertyModel => {
    const isCollection = !!p.$.Type.match(/^Collection\(/);
    const dataType = p.$.Type.replace(/^Collection\(([^\)]+)\)/, "$1");

    const result: Partial<PropertyModel> = {
      odataName: p.$.Name,
      name: firstCharLowerCase(p.$.Name),
      odataType: p.$.Type,
      required: p.$.Nullable === "false",
      isCollection: isCollection,
    };

    // domain object known from service, e.g. EntitySet, EnumType, ...
    if (dataType.startsWith(this.servicePrefix)) {
      const newType = this.stripServicePrefix(dataType);
      const enumType = this.enumTypes[newType];
      // special handling for enums
      if (enumType) {
        result.type = enumType.name;
        result.dataType = DataTypes.EnumType;
      } else {
        result.type = this.getModelName(newType);
        result.dataType = DataTypes.ModelType;
      }
    }
    // OData built-in data types
    else if (dataType.startsWith(EDM_PREFIX)) {
      result.type = this.mapODataType(dataType);
      result.dataType = DataTypes.PrimitiveType;
    } else {
      throw Error(
        `Unknown type [${dataType}]: Not 'Collection(...)', not '${this.servicePrefix}*', not OData type 'Edm.*'`
      );
    }

    return result as PropertyModel;
  };

  private mapODataType(type: string): string {
    switch (type) {
      case OdataTypes.Boolean:
        return "boolean";
      case OdataTypes.Byte:
      case OdataTypes.SByte:
      case OdataTypes.Int16:
      case OdataTypes.Int32:
      case OdataTypes.Int64:
      case OdataTypes.Decimal:
      case OdataTypes.Double:
      case OdataTypes.Single:
        return "number";
      case OdataTypes.String:
        return "string";
      case OdataTypes.Date:
        const dateType = "DateString";
        this.primitiveTypeImports.add(dateType);
        return dateType;
      case OdataTypes.Time:
        const timeType = "TimeOfDayString";
        this.primitiveTypeImports.add(timeType);
        return timeType;
      case OdataTypes.DateTimeOffset:
        const dateTimeType = "DateTimeOffsetString";
        this.primitiveTypeImports.add(dateTimeType);
        return dateTimeType;
      case OdataTypes.Binary:
        const binaryType = "BinaryString";
        this.primitiveTypeImports.add(binaryType);
        return binaryType;
      case OdataTypes.Guid:
        const guidType = "GuidString";
        this.primitiveTypeImports.add(guidType);
        return guidType;
      default:
        return "string";
    }
  }

  private addOperations(operations: Array<Function | Action>, type: OperationTypes) {
    if (!operations || !operations.length) {
      return;
    }

    operations.forEach((op) => {
      const params: Array<PropertyModel> = op.Parameter?.map(this.mapProperty) ?? [];
      const returnType: PropertyModel | undefined = op.ReturnType?.map((rt) => {
        return this.mapProperty({ ...rt, $: { Name: "workaround", ...rt.$ } });
      })[0];
      const isBound = op.$.IsBound === "true";

      if (isBound && !params.length) {
        throw Error(`IllegalState: Operation '${op.$.Name}' is bound, but has no parameters!`);
      }

      const binding = isBound ? params[0].type : ROOT_OPERATION;
      if (!this.operationTypes[binding]) {
        this.operationTypes[binding] = [];
      }

      this.operationTypes[binding].push({
        odataName: op.$.Name,
        name: this.getOperationName(op.$.Name),
        type: type,
        parameters: params,
        returnType: returnType ? { odataType: returnType.odataType, type: returnType.type } : undefined,
      });
    });
  }

  private digestEntityContainer(container: EntityContainer) {
    const { actions, functions, singletons, entitySets } = this.container;

    container.ActionImport?.forEach((actionImport) => {
      const name = this.getOperationName(actionImport.$.Name);
      const operationName = this.getOperationName(actionImport.$.Action);

      actions[name] = {
        name: name,
        odataName: actionImport.$.Name,
        operation: this.getRootOperationType(operationName),
      };
    });

    container.FunctionImport?.forEach((funcImport) => {
      const name = this.getOperationName(funcImport.$.Name);
      const operationName = this.getOperationName(funcImport.$.Function);

      functions[name] = {
        name,
        odataName: funcImport.$.Name,
        operation: this.getRootOperationType(operationName),
        entitySet: funcImport.$.EntitySet,
      };
    });

    container.Singleton?.forEach((singleton) => {
      const name = this.getEntryPointName(singleton.$.Name);
      singletons[name] = {
        name,
        odataName: singleton.$.Name,
        type: this.getModel(this.getModelName(singleton.$.Type)),
      };
    });

    container.EntitySet?.forEach((entitySet) => {
      const name = this.getEntryPointName(entitySet.$.Name);

      entitySets[name] = {
        name,
        odataName: entitySet.$.Name,
        entityType: this.getModel(this.getModelName(entitySet.$.EntityType)),
        navPropBinding: entitySet.NavigationPropertyBinding?.map((binding) => ({
          path: this.stripServicePrefix(binding.$.Path),
          target: binding.$.Target,
        })),
      };
    });
  }

  /**
   * The service name.
   * @returns
   */
  public getServiceName() {
    return this.serviceName;
  }

  /**
   * The prefix used to reference model or enum types in this schema.
   * @returns service prefix
   */
  public getServicePrefix() {
    return this.servicePrefix;
  }

  /**
   * Get a specific model by its name.
   *
   * @param modelName the final model name that is generated
   * @returns the model type
   */
  public getModel(modelName: string) {
    return this.modelTypes[modelName];
  }

  /**
   * Retrieve all knwon models, i.e. EntityType and ComplexType nodes from the EDMX model.
   *
   * @returns list of model types
   */
  public getModels() {
    return Object.values(this.modelTypes);
  }

  /**
   * Get a specific enum by its enum
   *
   * @param name the final enum name that is generated
   * @returns enum type
   */
  public getEnum(name: string) {
    return this.enumTypes[name];
  }

  /**
   * Get list of all known enums, i.e. EnumType nodes from the EDMX model.
   * @returns list of enum types
   */
  public getEnums() {
    return Object.values(this.enumTypes);
  }

  /**
   * Get all special primitive data types, i.e. data types which are represented at strings,
   * but convey a specific meaning: DateString, GuidString, etc.
   *
   * @returns list of additional data types to import when working with the data model
   */
  public getPrimitiveTypeImports(): Array<string> {
    return [...this.primitiveTypeImports];
  }

  public getRootOperationType(name: string): OperationType {
    const rootOps = this.operationTypes[ROOT_OPERATION] || [];
    const rootOp = rootOps.find((op) => op.name === name);
    if (!rootOp) {
      throw Error(`Couldn't find root operation with name [${name}]`);
    }
    return rootOp;
  }

  public getOperationTypeByBinding(binding: string): Array<OperationType> | undefined {
    return [...this.operationTypes[binding]];
  }

  public getEntityContainer() {
    return this.container;
  }
}