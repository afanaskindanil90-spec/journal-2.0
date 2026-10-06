import {
  type KeySchemaElement,
  type AttributeDefinition,
  type GlobalSecondaryIndex,
} from "@aws-sdk/client-dynamodb";

export const TableName = {
  CLASSES: "classes",
  JOURNAL: "journal",
  SERVICES: "services",
} as const;

export type TableName = (typeof TableName)[keyof typeof TableName];

export interface TableSchema {
  name: TableName;
  keySchema: KeySchemaElement[];
  attributeDefinitions: AttributeDefinition[];
  globalSecondaryIndexes?: GlobalSecondaryIndex[];
}

export const TABLE_SCHEMAS: Record<TableName, TableSchema> = {
  [TableName.CLASSES]: {
    name: TableName.CLASSES,
    keySchema: [{ AttributeName: "id", KeyType: "HASH" }],
    attributeDefinitions: [{ AttributeName: "id", AttributeType: "S" }],
  },
  [TableName.JOURNAL]: {
    name: TableName.JOURNAL,
    keySchema: [
      { AttributeName: "classId", KeyType: "HASH" },
      { AttributeName: "date", KeyType: "RANGE" },
    ],
    attributeDefinitions: [
      { AttributeName: "classId", AttributeType: "S" },
      { AttributeName: "date", AttributeType: "S" },
    ],
  },
  [TableName.SERVICES]: {
    name: TableName.SERVICES,
    keySchema: [{ AttributeName: "id", KeyType: "HASH" }],
    attributeDefinitions: [
      { AttributeName: "id", AttributeType: "S" },
      { AttributeName: "status", AttributeType: "S" },
    ],
    globalSecondaryIndexes: [
      {
        IndexName: "status-index",
        KeySchema: [{ AttributeName: "status", KeyType: "HASH" }],
        Projection: { ProjectionType: "ALL" },
      },
    ],
  },
};

export const TABLE_NAMES: TableName[] = Object.values(TableName);

export const IndexName = {
  SERVICES_STATUS: "status-index",
} as const;

export type IndexName = (typeof IndexName)[keyof typeof IndexName];
