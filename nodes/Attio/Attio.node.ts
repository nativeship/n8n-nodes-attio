import { NodeConnectionTypes, NodeApiError, NodeOperationError, type IDataObject, type IExecuteFunctions, type IHttpRequestOptions, type INodeExecutionData, type INodeType, type INodeTypeDescription, type JsonObject } from "n8n-workflow";
import { requestWithRetry, resolveServerBaseUrl } from "../../shared/http";

// Generated with ts-morph
type CredentialApplication = { credentialType: string; type: 'apiKey' | 'basic' | 'bearer' | 'oauth2' | 'custom'; location?: 'header' | 'query'; parameter?: string; injections?: Array<{ target: 'header' | 'query' | 'body'; name: string; value: string }> };
type RetryContract = { mode: string; retryConnectionFailures?: boolean; retryTimeouts?: boolean; retryRateLimits?: boolean; retryServerErrors?: boolean; maxAttempts: number; maxElapsedMs: number; baseBackoffMs: number; maxBackoffMs: number; jitterRatio: number; idempotency?: { target: 'header' | 'query' | 'body'; parameter: string } };
type PaginationContract = { style: string; page?: string; limit?: string; cursor?: string; responseCursor?: string; hasMore?: string; itemPath?: string; advancement?: string; maxPages: number; maxItems: number; maxElapsedMs: number; maxMemoryBytes: number; repeatedCursorLimit: number; repeatedPageLimit: number; pageSize: number };

function normalizeParameterValue(value: unknown): IDataObject[string] {
  if (value && typeof value === 'object' && 'value' in value) return (value as { value: IDataObject[string] }).value;
  return value as IDataObject[string];
}


type BodyFieldContract = {
  name: string;
  displayName?: string;
  description?: string;
  placeholder?: string;
  type?: string;
  format?: string;
  required?: boolean;
  minValue?: number;
  maxValue?: number;
  enum?: unknown[];
  default?: unknown;
  example?: unknown;
  pattern?: string;
  fields?: BodyFieldContract[];
  items?: BodyFieldContract;
  additionalValue?: BodyFieldContract;
  alternatives?: BodyFieldContract[];
  composition?: 'oneOf' | 'anyOf';
  representation?: string;
  nullable?: boolean;
};

function normalizeJsonValue(value: unknown, label: string, context: IExecuteFunctions, itemIndex: number): IDataObject | IDataObject[] | string | number | boolean | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return {};
    try {
      return JSON.parse(trimmed) as IDataObject | IDataObject[] | string | number | boolean | null;
    } catch (error) {
      throw new NodeOperationError(context.getNode(), `${label} must be valid JSON: ${(error as Error).message}`, { itemIndex });
    }
  }
  if (value === null || Array.isArray(value) || (value && typeof value === 'object') || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value as IDataObject | IDataObject[] | string | number | boolean | null;
  throw new NodeOperationError(context.getNode(), `${label} must be valid JSON`, { itemIndex });
}


function validateBodyValue(value: unknown, contract: BodyFieldContract, path: string, context: IExecuteFunctions, itemIndex: number): void {
  if (value === undefined || value === '') {
    if (contract.required) throw new NodeOperationError(context.getNode(), `${path} is required`, { itemIndex });
    return;
  }
  if (value === null) {
    if (contract.nullable) return;
    throw new NodeOperationError(context.getNode(), `${path} must not be null`, { itemIndex });
  }
  if (contract.alternatives?.length) {
    selectAlternativeValue(value, contract, path, context, itemIndex);
    return;
  }
  if (contract.type === 'string' && typeof value !== 'string') throw new NodeOperationError(context.getNode(), `${path} must be a string`, { itemIndex });
  if (contract.type === 'boolean' && typeof value !== 'boolean') throw new NodeOperationError(context.getNode(), `${path} must be a boolean`, { itemIndex });
  if (contract.type === 'number' && typeof value !== 'number') throw new NodeOperationError(context.getNode(), `${path} must be a number`, { itemIndex });
  if (contract.type === 'integer' && (typeof value !== 'number' || !Number.isInteger(value))) throw new NodeOperationError(context.getNode(), `${path} must be an integer`, { itemIndex });
  if (contract.enum?.length) {
    const enumValueMatches = (candidate: unknown): boolean => candidate === value ||
      (candidate === null && value === 'null') ||
      (candidate === 'null' && value === null) ||
      Boolean(candidate && value && typeof candidate === 'object' && typeof value === 'object' && JSON.stringify(candidate) === JSON.stringify(value));
    const scalarEnum = contract.enum.every((candidate) => candidate === null || ['string', 'number', 'boolean'].includes(typeof candidate));
    const matches = contract.type === 'array' && Array.isArray(value) && scalarEnum
      ? value.every((item) => contract.enum!.some((candidate) => candidate === item || (candidate === null && item === 'null') || (candidate === 'null' && item === null)))
      : contract.enum.some(enumValueMatches);
    if (!matches) throw new NodeOperationError(context.getNode(), `${path} must be one of: ${contract.enum.join(', ')}`, { itemIndex });
  }
  if (contract.type === 'number' || contract.type === 'integer') {
    const numeric = value as number;
    if (contract.minValue !== undefined && numeric < contract.minValue) throw new NodeOperationError(context.getNode(), `${path} must be at least ${contract.minValue}`, { itemIndex });
    if (contract.maxValue !== undefined && numeric > contract.maxValue) throw new NodeOperationError(context.getNode(), `${path} must be at most ${contract.maxValue}`, { itemIndex });
  }
  if (contract.pattern && typeof value === 'string' && !new RegExp(contract.pattern).test(value)) throw new NodeOperationError(context.getNode(), `${path} must match ${contract.pattern}`, { itemIndex });
  if (contract.format === 'email' && typeof value === 'string' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/u.test(value)) throw new NodeOperationError(context.getNode(), `${path} must be an email address`, { itemIndex });
  if ((contract.format === 'uri' || contract.format === 'url') && typeof value === 'string') {
    try {
      new URL(value);
    } catch {
      throw new NodeOperationError(context.getNode(), `${path} must be a URL`, { itemIndex });
    }
  }
  if (contract.format === 'uuid' && typeof value === 'string' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value)) throw new NodeOperationError(context.getNode(), `${path} must be a UUID`, { itemIndex });
  if (contract.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new NodeOperationError(context.getNode(), `${path} must be a JSON object`, { itemIndex });
    const objectValue = value as IDataObject;
    for (const child of contract.fields ?? []) validateBodyValue(objectValue[child.name], child, `${path}.${child.name}`, context, itemIndex);
    if (contract.additionalValue) {
      const known = new Set((contract.fields ?? []).map((field) => field.name));
      for (const [key, childValue] of Object.entries(objectValue)) {
        if (!known.has(key)) {
          if (contract.additionalValue.alternatives?.length && contract.additionalValue.representation === 'raw') continue;
          validateBodyValue(childValue, contract.additionalValue, `${path}.${key}`, context, itemIndex);
        }
      }
    }
  }
  if (contract.type === 'array') {
    if (!Array.isArray(value)) throw new NodeOperationError(context.getNode(), `${path} must be a JSON array`, { itemIndex });
    if (contract.items) value.forEach((item, index) => validateBodyValue(item, contract.items!, `${path}[${index}]`, context, itemIndex));
  }
}

function setBodyField(body: IDataObject, contract: BodyFieldContract, value: unknown, context: IExecuteFunctions, itemIndex: number): void {
  const normalized = contract.type === 'object' || contract.type === 'array' || contract.type === 'alternative' || contract.representation === 'raw'
    ? normalizeJsonValue(value, contract.displayName ?? contract.name, context, itemIndex)
    : normalizeParameterValue(value);
  const selected = contract.alternatives?.length ? selectAlternativeValue(normalized, contract, contract.name, context, itemIndex) : normalized;
  validateBodyValue(selected, { ...contract, alternatives: undefined, composition: undefined }, contract.name, context, itemIndex);
  body[contract.name] = selected as IDataObject[string];
}


function selectAlternativeValue(value: unknown, contract: BodyFieldContract, path: string, context: IExecuteFunctions, itemIndex: number): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new NodeOperationError(context.getNode(), `${path} must include an explicit schema alternative and value`, { itemIndex });
  const selectedName = String((value as IDataObject).schemaAlternative ?? '');
  const selected = (contract.alternatives ?? []).find((alternative) => alternative.name === selectedName);
  if (!selected) throw new NodeOperationError(context.getNode(), `${path} schema alternative must be one of: ${(contract.alternatives ?? []).map((alternative) => alternative.name).join(', ')}`, { itemIndex });
  const selectedValue = (value as IDataObject).value;
  validateBodyValue(selectedValue, selected, path, context, itemIndex);
  return selectedValue;
}

function encodeFormValue(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value) || (value && typeof value === 'object')) return JSON.stringify(value);
  return String(value);
}



function toFormData(body: IDataObject): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(body)) form.append(key, encodeFormValue(value));
  return form;
}

function selectResponseFields(value: IDataObject, fields: string[]): IDataObject {
  if (fields.length === 0) return value;
  const selected: IDataObject = {};
  if (value.id !== undefined) selected.id = value.id;
  for (const field of fields) if (value[field] !== undefined) selected[field] = value[field];
  return selected;
}

function valueAtPath(value: unknown, path: string): unknown {
  if (!path) return value;
  return path.split('.').filter(Boolean).reduce((current: unknown, segment) => {
    if (current === undefined || current === null) return undefined;
    if (Array.isArray(current)) return current[Number(segment)];
    return (current as IDataObject)[segment];
  }, value);
}

export class Attio implements INodeType {
  description: INodeTypeDescription = {
        displayName: "Attio",
        name: "attio",
        icon: {
            light: "file:attio.svg",
            dark: "file:attio.dark.svg"
        },
        group: [],
        version: [
            1
        ],
        subtitle: "={{((JSON.parse(\"\\u007b\\\"activities\\\":\\u007b\\\"deleteV2ActivitiesActivity\\\":\\\"deleteAnActivity: activity\\\",\\\"getV2Activities\\\":\\\"listActivities: activity\\\",\\\"getV2ActivitiesActivity\\\":\\\"getAnActivity: activity\\\",\\\"patchV2ActivitiesActivity\\\":\\\"updateAnActivity: activity\\\",\\\"postV2Activities\\\":\\\"createAnActivity: activity\\\"\\u007d,\\\"activityRecords\\\":\\u007b\\\"deleteV2ActivitiesActivityRecordsRecordId\\\":\\\"deleteAnActivityRecord: activityRecord\\\",\\\"getV2ActivitiesActivityRecordsRecordId\\\":\\\"getAnActivityRecord: activityRecord\\\",\\\"patchV2ActivitiesActivityRecordsRecordId\\\":\\\"updateAnActivityRecord: activityRecord\\\",\\\"postV2ActivitiesActivityRecords\\\":\\\"createAnActivityRecord: activityRecord\\\",\\\"postV2ActivitiesActivityRecordsQuery\\\":\\\"listActivityRecords: activityRecord\\\",\\\"putV2ActivitiesActivityRecords\\\":\\\"upsertAnActivityRecord: activityRecord\\\",\\\"putV2ActivitiesActivityRecordsRecordId\\\":\\\"updateAnActivityRecord: activityRecord\\\"\\u007d,\\\"attributes\\\":\\u007b\\\"getV2TargetIdentifierAttributes\\\":\\\"listAttributes: attribute\\\",\\\"getV2TargetIdentifierAttributesAttribute\\\":\\\"getAnAttribute: attribute\\\",\\\"getV2TargetIdentifierAttributesAttributeOptions\\\":\\\"listSelectOptions: attribute\\\",\\\"getV2TargetIdentifierAttributesAttributeStatuses\\\":\\\"listStatuses: attribute\\\",\\\"patchV2TargetIdentifierAttributesAttribute\\\":\\\"updateAnAttribute: attribute\\\",\\\"patchV2TargetIdentifierAttributesAttributeOptionsOption\\\":\\\"updateASelectOption: attribute\\\",\\\"patchV2TargetIdentifierAttributesAttributeStatusesStatus\\\":\\\"updateAStatus: attribute\\\",\\\"postV2TargetIdentifierAttributes\\\":\\\"createAnAttribute: attribute\\\",\\\"postV2TargetIdentifierAttributesAttributeOptions\\\":\\\"createASelectOption: attribute\\\",\\\"postV2TargetIdentifierAttributesAttributeStatuses\\\":\\\"createAStatus: attribute\\\"\\u007d,\\\"callRecordings\\\":\\u007b\\\"deleteV2MeetingsMeetingIdCallRecordingsCallRecordingId\\\":\\\"deleteCallRecording: callRecording\\\",\\\"getV2MeetingsMeetingIdCallRecordings\\\":\\\"listCallRecordings: callRecording\\\",\\\"getV2MeetingsMeetingIdCallRecordingsCallRecordingId\\\":\\\"getCallRecording: callRecording\\\",\\\"postV2MeetingsMeetingIdCallRecordings\\\":\\\"createCallRecording: callRecording\\\"\\u007d,\\\"emails\\\":\\u007b\\\"getV2Emails\\\":\\\"listEmails: email\\\"\\u007d,\\\"entries\\\":\\u007b\\\"deleteV2ListsListEntriesEntryId\\\":\\\"deleteAListEntry: entry\\\",\\\"getV2ListsListEntriesEntryId\\\":\\\"getAListEntry: entry\\\",\\\"getV2ListsListEntriesEntryIdAttributesAttributeValues\\\":\\\"listAttributeValuesForAListEntry: entry\\\",\\\"patchV2ListsListEntriesEntryId\\\":\\\"updateAListEntryAppendMultiselectValues: entry\\\",\\\"postV2ListsListEntries\\\":\\\"createAnEntryAddRecordToList: entry\\\",\\\"postV2ListsListEntriesQuery\\\":\\\"listEntries: entry\\\",\\\"putV2ListsListEntries\\\":\\\"upsertAListEntryByParent: entry\\\",\\\"putV2ListsListEntriesEntryId\\\":\\\"updateAListEntryOverwriteMultiselectValues: entry\\\",\\\"putV2ListsListEntriesEntryIdAttributesAttributeValues\\\":\\\"writeListEntryAttributeValues: entry\\\"\\u007d,\\\"files\\\":\\u007b\\\"deleteV2FilesFileId\\\":\\\"deleteAFile: file\\\",\\\"getV2Files\\\":\\\"listFiles: file\\\",\\\"getV2FilesFileId\\\":\\\"getAFile: file\\\",\\\"getV2FilesFileIdDownload\\\":\\\"downloadAFile: file\\\",\\\"postV2Files\\\":\\\"createAFolder: file\\\",\\\"postV2FilesUpload\\\":\\\"uploadAFile: file\\\"\\u007d,\\\"lists\\\":\\u007b\\\"getV2Lists\\\":\\\"listAllLists: list\\\",\\\"getV2ListsList\\\":\\\"getAList: list\\\",\\\"getV2ListsListViews\\\":\\\"listViewsForList: list\\\",\\\"patchV2ListsList\\\":\\\"updateAList: list\\\",\\\"postV2Lists\\\":\\\"createAList: list\\\"\\u007d,\\\"meetings\\\":\\u007b\\\"deleteV2MeetingsMeetingId\\\":\\\"deleteAMeeting: meeting\\\",\\\"getV2Meetings\\\":\\\"listMeetings: meeting\\\",\\\"getV2MeetingsMeetingId\\\":\\\"getAMeeting: meeting\\\",\\\"patchV2MeetingsMeetingId\\\":\\\"updateAMeetingAppendLinkedRecords: meeting\\\",\\\"postV2Meetings\\\":\\\"createAMeeting: meeting\\\",\\\"putV2MeetingsMeetingId\\\":\\\"updateAMeetingOverwriteLinkedRecords: meeting\\\"\\u007d,\\\"meta\\\":\\u007b\\\"getV2Self\\\":\\\"identify: meta\\\"\\u007d,\\\"notes\\\":\\u007b\\\"deleteV2NotesNoteId\\\":\\\"deleteANote: note\\\",\\\"getV2Notes\\\":\\\"listNotes: note\\\",\\\"getV2NotesNoteId\\\":\\\"getANote: note\\\",\\\"patchV2NotesNoteId\\\":\\\"updateANote: note\\\",\\\"postV2Notes\\\":\\\"createANote: note\\\"\\u007d,\\\"objects\\\":\\u007b\\\"deleteV2ObjectsObject\\\":\\\"deleteAnObject: object\\\",\\\"getV2Objects\\\":\\\"listObjects: object\\\",\\\"getV2ObjectsObject\\\":\\\"getAnObject: object\\\",\\\"getV2ObjectsObjectViews\\\":\\\"listViewsForObject: object\\\",\\\"patchV2ObjectsObject\\\":\\\"updateAnObject: object\\\",\\\"postV2Objects\\\":\\\"createAnObject: object\\\"\\u007d,\\\"records\\\":\\u007b\\\"deleteV2ObjectsObjectRecordsRecordId\\\":\\\"deleteARecord: record\\\",\\\"getV2ObjectsObjectRecordsRecordId\\\":\\\"getARecord: record\\\",\\\"getV2ObjectsObjectRecordsRecordIdAttributesAttributeValues\\\":\\\"listRecordAttributeValues: record\\\",\\\"getV2ObjectsObjectRecordsRecordIdEntries\\\":\\\"listRecordEntries: record\\\",\\\"patchV2ObjectsObjectRecordsRecordId\\\":\\\"updateARecordAppendMultiselectValues: record\\\",\\\"postV2ObjectsObjectRecords\\\":\\\"createARecord: record\\\",\\\"postV2ObjectsObjectRecordsMerge\\\":\\\"mergeTwoRecords: record\\\",\\\"postV2ObjectsObjectRecordsQuery\\\":\\\"listRecords: record\\\",\\\"postV2ObjectsRecordsSearch\\\":\\\"searchRecords: record\\\",\\\"putV2ObjectsObjectRecords\\\":\\\"upsertARecord: record\\\",\\\"putV2ObjectsObjectRecordsRecordId\\\":\\\"updateARecordOverwriteMultiselectValues: record\\\",\\\"putV2ObjectsObjectRecordsRecordIdAttributesAttributeValues\\\":\\\"writeRecordAttributeValues: record\\\"\\u007d,\\\"sequences\\\":\\u007b\\\"postV2SequencesUnsubscribedEmails\\\":\\\"addEmailsToTheUnsubscribeList: sequence\\\"\\u007d,\\\"tasks\\\":\\u007b\\\"deleteV2TasksTaskId\\\":\\\"deleteATask: task\\\",\\\"getV2Tasks\\\":\\\"listTasks: task\\\",\\\"getV2TasksTaskId\\\":\\\"getATask: task\\\",\\\"patchV2TasksTaskId\\\":\\\"updateATask: task\\\",\\\"postV2Tasks\\\":\\\"createATask: task\\\"\\u007d,\\\"threads\\\":\\u007b\\\"getV2Threads\\\":\\\"listThreads: thread\\\",\\\"getV2ThreadsThreadId\\\":\\\"getAThreadAndItsComments: thread\\\"\\u007d\\u007d\"))[$parameter[\"resource\"]] || {})[$parameter[\"operation\"]] || ($parameter[\"operation\"] + \": \" + $parameter[\"resource\"])}}",
        description: "Attio is a flexible CRM for managing customer records, deals, lists, and sales workflows.",
        documentationUrl: "https://api.attio.com",
        hints: [
            {
                message: "Operation \"\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                type: "warning",
                location: "inputPane",
                whenToDisplay: "always"
            },
            {
                message: "Operation \"\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                type: "warning",
                location: "inputPane",
                whenToDisplay: "always"
            },
            {
                message: "Operation \"\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                type: "warning",
                location: "inputPane",
                whenToDisplay: "always"
            },
            {
                message: "Operation \"\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                type: "warning",
                location: "inputPane",
                whenToDisplay: "always"
            },
            {
                message: "Operation \"\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                type: "warning",
                location: "inputPane",
                whenToDisplay: "always"
            },
            {
                message: "Operation \"\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                type: "warning",
                location: "inputPane",
                whenToDisplay: "always"
            },
            {
                message: "Operation \"\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                type: "warning",
                location: "inputPane",
                whenToDisplay: "always"
            },
            {
                message: "Operation \"\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                type: "warning",
                location: "inputPane",
                whenToDisplay: "always"
            },
            {
                message: "Operation \"\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                type: "warning",
                location: "inputPane",
                whenToDisplay: "always"
            },
            {
                message: "Operation \"\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                type: "warning",
                location: "inputPane",
                whenToDisplay: "always"
            },
            {
                message: "Operation \"\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                type: "warning",
                location: "inputPane",
                whenToDisplay: "always"
            },
            {
                message: "Operation \"\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                type: "warning",
                location: "inputPane",
                whenToDisplay: "always"
            },
            {
                message: "Operation \"\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                type: "warning",
                location: "inputPane",
                whenToDisplay: "always"
            },
            {
                message: "Operation \"\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                type: "warning",
                location: "inputPane",
                whenToDisplay: "always"
            },
            {
                message: "Operation \"\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                type: "warning",
                location: "inputPane",
                whenToDisplay: "always"
            },
            {
                message: "Operation \"\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                type: "warning",
                location: "inputPane",
                whenToDisplay: "always"
            },
            {
                message: "Operation \"\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                type: "warning",
                location: "inputPane",
                whenToDisplay: "always"
            }
        ],
        defaults: {
            name: "Attio"
        },
        usableAsTool: true,
        inputs: [
            NodeConnectionTypes.Main
        ],
        outputs: [
            NodeConnectionTypes.Main
        ],
        credentials: [
            {
                name: "attioOAuth2Api",
                required: true
            }
        ],
        properties: [
            {
                displayName: "Resource",
                name: "resource",
                type: "options",
                noDataExpression: true,
                default: "activities",
                options: [
                    {
                        name: "Activity",
                        value: "activities"
                    },
                    {
                        name: "Activity Record",
                        value: "activityRecords"
                    },
                    {
                        name: "Attribute",
                        value: "attributes"
                    },
                    {
                        name: "Call Recording",
                        value: "callRecordings"
                    },
                    {
                        name: "Email",
                        value: "emails"
                    },
                    {
                        name: "Entry",
                        value: "entries"
                    },
                    {
                        name: "File",
                        value: "files"
                    },
                    {
                        name: "List",
                        value: "lists"
                    },
                    {
                        name: "Meeting",
                        value: "meetings"
                    },
                    {
                        name: "Meta",
                        value: "meta"
                    },
                    {
                        name: "Note",
                        value: "notes"
                    },
                    {
                        name: "Object",
                        value: "objects"
                    },
                    {
                        name: "Record",
                        value: "records"
                    },
                    {
                        name: "Sequence",
                        value: "sequences"
                    },
                    {
                        name: "Task",
                        value: "tasks"
                    },
                    {
                        name: "Thread",
                        value: "threads"
                    }
                ]
            },
            {
                displayName: "Operation",
                name: "operation",
                type: "options",
                noDataExpression: true,
                displayOptions: {
                    show: {
                        resource: [
                            "activities"
                        ]
                    }
                },
                default: "deleteV2ActivitiesActivity",
                options: [
                    {
                        name: "Create An",
                        value: "postV2Activities",
                        action: "Create activity",
                        description: "Create a custom activity. the workspace must have custom activities enabled; public apps can use the integration activities feature."
                    },
                    {
                        name: "Delete An",
                        value: "deleteV2ActivitiesActivity",
                        action: "Delete activity",
                        description: "Delete an activity by ID or slug, along with its records. archived activities can also be deleted."
                    },
                    {
                        name: "Get An",
                        value: "getV2ActivitiesActivity",
                        action: "Get activity",
                        description: "Gets a single activity by its `activity_id` or slug. this endpoint is in alpha and may be subject to breaking changes as we gather feedback. required scopes: `activity_configuration:read`. supported token levels: `workspace`, `user`."
                    },
                    {
                        name: "List",
                        value: "getV2Activities",
                        action: "List activities",
                        description: "Lists all system-defined and user-defined activities in your workspace. this endpoint is in alpha and may be subject to breaking changes as we gather feedback. required scopes: `activity_configuration:read`. supported token levels: `workspace`, `user`."
                    },
                    {
                        name: "Update An",
                        value: "patchV2ActivitiesActivity",
                        action: "Update activity",
                        description: "Update an activity by ID or slug. its schema extension cannot be changed after creation."
                    }
                ]
            },
            {
                displayName: "Activity",
                name: "activity",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. phone_calls",
                displayOptions: {
                    show: {
                        resource: [
                            "activities"
                        ],
                        operation: [
                            "deleteV2ActivitiesActivity"
                        ]
                    }
                }
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "activities"
                        ],
                        operation: [
                            "getV2Activities"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Cursor",
                        name: "cursor",
                        type: "string",
                        default: "",
                        placeholder: "e.g. eyJkZXNjcmlwdGlvbiI6ICJ0aGlzIGlzIGEgY3Vyc29yIn0=.eM56CGbqZ6G1NHiJchTIkH4vKDr"
                    },
                    {
                        displayName: "Limit",
                        name: "limit",
                        type: "number",
                        default: 50,
                        description: "Max number of results to return",
                        placeholder: "e.g. 100",
                        typeOptions: {
                            minValue: 1
                        }
                    }
                ]
            },
            {
                displayName: "Activity",
                name: "activity",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. phone_calls",
                displayOptions: {
                    show: {
                        resource: [
                            "activities"
                        ],
                        operation: [
                            "getV2ActivitiesActivity"
                        ]
                    }
                }
            },
            {
                displayName: "Activity",
                name: "activity",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. phone_calls",
                displayOptions: {
                    show: {
                        resource: [
                            "activities"
                        ],
                        operation: [
                            "patchV2ActivitiesActivity"
                        ]
                    }
                }
            },
            {
                displayName: "Data",
                name: "data",
                type: "collection",
                default: {},
                placeholder: "Add Field",
                options: [
                    {
                        displayName: "API Slug",
                        name: "api_slug",
                        type: "string",
                        default: "",
                        description: "A unique, human-readable slug to access the activity through URLs and API calls. should be formatted in snake case.",
                        placeholder: "e.g. site_visits"
                    },
                    {
                        displayName: "Plural Noun",
                        name: "plural_noun",
                        type: "string",
                        default: "",
                        description: "The plural form of the activity's name",
                        placeholder: "e.g. Site visits"
                    },
                    {
                        displayName: "Singular Noun",
                        name: "singular_noun",
                        type: "string",
                        default: "",
                        description: "The singular form of the activity's name",
                        placeholder: "e.g. Site visit"
                    }
                ],
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "activities"
                        ],
                        operation: [
                            "patchV2ActivitiesActivity"
                        ]
                    }
                }
            },
            {
                displayName: "Data",
                name: "data",
                type: "collection",
                default: {
                    api_slug: "",
                    extends: "activities",
                    plural_noun: "",
                    singular_noun: ""
                },
                placeholder: "Add Field",
                options: [
                    {
                        displayName: "API Slug",
                        name: "api_slug",
                        type: "string",
                        default: "",
                        description: "A unique, human-readable slug to access the activity through URLs and API calls. should be formatted in snake case.",
                        placeholder: "e.g. site_visits"
                    },
                    {
                        displayName: "Extends",
                        name: "extends",
                        type: "options",
                        default: "activities",
                        description: "The schema the new activity extends, which supplies its inherited attributes. one of `activities`, `interactions`, `calls` or `emails`.",
                        placeholder: "e.g. interactions",
                        options: [
                            {
                                name: "Activities",
                                value: "activities"
                            },
                            {
                                name: "Calls",
                                value: "calls"
                            },
                            {
                                name: "Emails",
                                value: "emails"
                            },
                            {
                                name: "Interactions",
                                value: "interactions"
                            }
                        ]
                    },
                    {
                        displayName: "Plural Noun",
                        name: "plural_noun",
                        type: "string",
                        default: "",
                        description: "The plural form of the activity's name",
                        placeholder: "e.g. Site visits"
                    },
                    {
                        displayName: "Singular Noun",
                        name: "singular_noun",
                        type: "string",
                        default: "",
                        description: "The singular form of the activity's name",
                        placeholder: "e.g. Site visit"
                    }
                ],
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "activities"
                        ],
                        operation: [
                            "postV2Activities"
                        ]
                    }
                }
            },
            {
                displayName: "Operation",
                name: "operation",
                type: "options",
                noDataExpression: true,
                displayOptions: {
                    show: {
                        resource: [
                            "activityRecords"
                        ]
                    }
                },
                default: "deleteV2ActivitiesActivityRecordsRecordId",
                options: [
                    {
                        name: "Create An",
                        value: "postV2ActivitiesActivityRecords",
                        action: "Create activity record",
                        description: "Create an activity record, such as a phone call"
                    },
                    {
                        name: "Delete An",
                        value: "deleteV2ActivitiesActivityRecordsRecordId",
                        action: "Delete activity record",
                        description: "Delete an activity record by record_id"
                    },
                    {
                        name: "Get An",
                        value: "getV2ActivitiesActivityRecordsRecordId",
                        action: "Get activity record",
                        description: "Get an activity record by record_id"
                    },
                    {
                        name: "List",
                        value: "postV2ActivitiesActivityRecordsQuery",
                        action: "List activity records",
                        description: "List activity records with optional filters and sorting"
                    },
                    {
                        name: "Update An",
                        value: "patchV2ActivitiesActivityRecordsRecordId",
                        action: "Update activity record",
                        description: "Update an activity record by record_id and prepend supplied multi-select values. use put to replace existing values."
                    },
                    {
                        name: "Update An (6)",
                        value: "putV2ActivitiesActivityRecordsRecordId",
                        action: "Update activity record",
                        description: "Update an activity record by record_id. supplied multi-select values replace existing values; use patch to add values without removing existing ones."
                    },
                    {
                        name: "Upsert An",
                        value: "putV2ActivitiesActivityRecords",
                        action: "Upsert activity record",
                        description: "Create or update an activity record by matching the specified attribute. a match is updated; otherwise, a record is created. use the create endpoint to avoid matching."
                    }
                ]
            },
            {
                displayName: "Activity",
                name: "activity",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. phone_calls",
                displayOptions: {
                    show: {
                        resource: [
                            "activityRecords"
                        ],
                        operation: [
                            "deleteV2ActivitiesActivityRecordsRecordId"
                        ]
                    }
                }
            },
            {
                displayName: "Record ID",
                name: "record_id",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. 5f4f2d9c-2b3e-4a83-9c76-1de3a3f14f26",
                hint: "Expected format: uuid",
                displayOptions: {
                    show: {
                        resource: [
                            "activityRecords"
                        ],
                        operation: [
                            "deleteV2ActivitiesActivityRecordsRecordId"
                        ]
                    }
                }
            },
            {
                displayName: "Activity",
                name: "activity",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. phone_calls",
                displayOptions: {
                    show: {
                        resource: [
                            "activityRecords"
                        ],
                        operation: [
                            "getV2ActivitiesActivityRecordsRecordId"
                        ]
                    }
                }
            },
            {
                displayName: "Record ID",
                name: "record_id",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. 5f4f2d9c-2b3e-4a83-9c76-1de3a3f14f26",
                hint: "Expected format: uuid",
                displayOptions: {
                    show: {
                        resource: [
                            "activityRecords"
                        ],
                        operation: [
                            "getV2ActivitiesActivityRecordsRecordId"
                        ]
                    }
                }
            },
            {
                displayName: "Activity",
                name: "activity",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. phone_calls",
                displayOptions: {
                    show: {
                        resource: [
                            "activityRecords"
                        ],
                        operation: [
                            "patchV2ActivitiesActivityRecordsRecordId"
                        ]
                    }
                }
            },
            {
                displayName: "Record ID",
                name: "record_id",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. 5f4f2d9c-2b3e-4a83-9c76-1de3a3f14f26",
                hint: "Expected format: uuid",
                displayOptions: {
                    show: {
                        resource: [
                            "activityRecords"
                        ],
                        operation: [
                            "patchV2ActivitiesActivityRecordsRecordId"
                        ]
                    }
                }
            },
            {
                displayName: "Data",
                name: "data",
                type: "collection",
                default: {
                    values: {}
                },
                placeholder: "Add Field",
                options: [
                    {
                        displayName: "Values",
                        name: "values",
                        type: "json",
                        default: {},
                        description: "Attribute values keyed by api_slug or attribute_id. pass one value for single-select attributes or an array for multi-select values; see attio's attribute type documentation for value formats.",
                        placeholder: "e.g. [object Object]"
                    }
                ],
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "activityRecords"
                        ],
                        operation: [
                            "patchV2ActivitiesActivityRecordsRecordId"
                        ]
                    }
                }
            },
            {
                displayName: "Activity",
                name: "activity",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. phone_calls",
                displayOptions: {
                    show: {
                        resource: [
                            "activityRecords"
                        ],
                        operation: [
                            "postV2ActivitiesActivityRecords"
                        ]
                    }
                }
            },
            {
                displayName: "Data",
                name: "data",
                type: "collection",
                default: {
                    values: {}
                },
                placeholder: "Add Field",
                options: [
                    {
                        displayName: "Values",
                        name: "values",
                        type: "json",
                        default: {},
                        description: "Attribute values keyed by api_slug or attribute_id. pass one value for single-select attributes or an array for multi-select values; see attio's attribute type documentation for value formats.",
                        placeholder: "e.g. [object Object]"
                    }
                ],
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "activityRecords"
                        ],
                        operation: [
                            "postV2ActivitiesActivityRecords"
                        ]
                    }
                }
            },
            {
                displayName: "Activity",
                name: "activity",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. phone_calls",
                displayOptions: {
                    show: {
                        resource: [
                            "activityRecords"
                        ],
                        operation: [
                            "postV2ActivitiesActivityRecordsQuery"
                        ]
                    }
                }
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "activityRecords"
                        ],
                        operation: [
                            "postV2ActivitiesActivityRecordsQuery"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Filter",
                        name: "filter",
                        type: "json",
                        default: {},
                        description: "An object used to filter results to a subset of results. cannot be used together with `filter_view_id`. see the full guide to filtering and sorting here.",
                        placeholder: "e.g. [object Object]"
                    },
                    {
                        displayName: "Limit",
                        name: "limit",
                        type: "number",
                        default: 50,
                        description: "Max number of results to return",
                        placeholder: "e.g. 500",
                        typeOptions: {
                            minValue: 1
                        }
                    },
                    {
                        displayName: "Offset",
                        name: "offset",
                        type: "number",
                        default: 0,
                        description: "The number of results to skip over before returning. defaults to 0. see the full guide to pagination here.",
                        placeholder: "e.g. 0"
                    },
                    {
                        displayName: "Sorts",
                        name: "sorts",
                        type: "json",
                        default: [],
                        description: "An object used to sort results. see the full guide to filtering and sorting here.",
                        placeholder: "e.g. [object Object]"
                    }
                ]
            },
            {
                displayName: "Activity",
                name: "activity",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. phone_calls",
                displayOptions: {
                    show: {
                        resource: [
                            "activityRecords"
                        ],
                        operation: [
                            "putV2ActivitiesActivityRecords"
                        ]
                    }
                }
            },
            {
                displayName: "Matching Attribute",
                name: "matching_attribute",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. 41252299-f8c7-4b5e-99c9-4ff8321d2f96",
                displayOptions: {
                    show: {
                        resource: [
                            "activityRecords"
                        ],
                        operation: [
                            "putV2ActivitiesActivityRecords"
                        ]
                    }
                }
            },
            {
                displayName: "Data",
                name: "data",
                type: "collection",
                default: {
                    values: {}
                },
                placeholder: "Add Field",
                options: [
                    {
                        displayName: "Values",
                        name: "values",
                        type: "json",
                        default: {},
                        description: "Attribute values keyed by api_slug or attribute_id. pass one value for single-select attributes or an array for multi-select values; see attio's attribute type documentation for value formats.",
                        placeholder: "e.g. [object Object]"
                    }
                ],
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "activityRecords"
                        ],
                        operation: [
                            "putV2ActivitiesActivityRecords"
                        ]
                    }
                }
            },
            {
                displayName: "Activity",
                name: "activity",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. phone_calls",
                displayOptions: {
                    show: {
                        resource: [
                            "activityRecords"
                        ],
                        operation: [
                            "putV2ActivitiesActivityRecordsRecordId"
                        ]
                    }
                }
            },
            {
                displayName: "Record ID",
                name: "record_id",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. 5f4f2d9c-2b3e-4a83-9c76-1de3a3f14f26",
                hint: "Expected format: uuid",
                displayOptions: {
                    show: {
                        resource: [
                            "activityRecords"
                        ],
                        operation: [
                            "putV2ActivitiesActivityRecordsRecordId"
                        ]
                    }
                }
            },
            {
                displayName: "Data",
                name: "data",
                type: "collection",
                default: {
                    values: {}
                },
                placeholder: "Add Field",
                options: [
                    {
                        displayName: "Values",
                        name: "values",
                        type: "json",
                        default: {},
                        description: "Attribute values keyed by api_slug or attribute_id. pass one value for single-select attributes or an array for multi-select values; see attio's attribute type documentation for value formats.",
                        placeholder: "e.g. [object Object]"
                    }
                ],
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "activityRecords"
                        ],
                        operation: [
                            "putV2ActivitiesActivityRecordsRecordId"
                        ]
                    }
                }
            },
            {
                displayName: "Operation",
                name: "operation",
                type: "options",
                noDataExpression: true,
                displayOptions: {
                    show: {
                        resource: [
                            "attributes"
                        ]
                    }
                },
                default: "getV2TargetIdentifierAttributes",
                options: [
                    {
                        name: "Create A Select Option",
                        value: "postV2TargetIdentifierAttributesAttributeOptions",
                        action: "Create select option attributes",
                        description: "Adds a select option to a select attribute on an object or a list. when `target` is `objects`, the required scopes are `object_configuration:read-write`. when `target` is `lists`, the required scopes are `list_configuration:read-write`. supported token levels: `workspace`, `user`."
                    },
                    {
                        name: "Create A Status",
                        value: "postV2TargetIdentifierAttributesAttributeStatuses",
                        action: "Create status attributes",
                        description: "Add a new status to a status attribute on either an object or a list. when `target` is `objects`, the required scopes are `object_configuration:read-write`. when `target` is `lists`, the required scopes are `list_configuration:read-write`. supported token levels: `workspace`, `user`."
                    },
                    {
                        name: "Create An",
                        value: "postV2TargetIdentifierAttributes",
                        action: "Create attribute",
                        description: "Create an attribute on an object or list. for record-reference attributes, an optional relationship setting creates a matching reverse attribute."
                    },
                    {
                        name: "Get An",
                        value: "getV2TargetIdentifierAttributesAttribute",
                        action: "Get attribute",
                        description: "Gets information about a single attribute on either an object or a list. when `target` is `objects`, the required scopes are `object_configuration:read`. when `target` is `lists`, the required scopes are `list_configuration:read`. supported token levels: `workspace`, `user`."
                    },
                    {
                        name: "List",
                        value: "getV2TargetIdentifierAttributes",
                        action: "List attributes",
                        description: "List attributes for an object or list in the order shown in the UI"
                    },
                    {
                        name: "List Select Options",
                        value: "getV2TargetIdentifierAttributesAttributeOptions",
                        action: "List select options attributes",
                        description: "Lists all select options for a particular attribute on either an object or a list. when `target` is `objects`, the required scopes are `object_configuration:read`. when `target` is `lists`, the required scopes are `list_configuration:read`. supported token levels: `workspace`, `user`."
                    },
                    {
                        name: "List Statuses",
                        value: "getV2TargetIdentifierAttributesAttributeStatuses",
                        action: "List statuses attributes",
                        description: "Lists all statuses for a particular status attribute on either an object or a list. when `target` is `objects`, the required scopes are `object_configuration:read`. when `target` is `lists`, the required scopes are `list_configuration:read`. supported token levels: `workspace`, `user`."
                    },
                    {
                        name: "Update A Select Option",
                        value: "patchV2TargetIdentifierAttributesAttributeOptionsOption",
                        action: "Update select option attributes",
                        description: "Updates a select option on an attribute on either an object or a list. when `target` is `objects`, the required scopes are `object_configuration:read-write`. when `target` is `lists`, the required scopes are `list_configuration:read-write`. supported token levels: `workspace`, `user`."
                    },
                    {
                        name: "Update A Status",
                        value: "patchV2TargetIdentifierAttributesAttributeStatusesStatus",
                        action: "Update status attributes",
                        description: "Update a status on an status attribute on either an object or a list. when `target` is `objects`, the required scopes are `object_configuration:read-write`. when `target` is `lists`, the required scopes are `list_configuration:read-write`. supported token levels: `workspace`, `user`."
                    },
                    {
                        name: "Update An",
                        value: "patchV2TargetIdentifierAttributesAttribute",
                        action: "Update attribute",
                        description: "Updates a single attribute on a given object or list. when `target` is `objects`, the required scopes are `object_configuration:read-write`. when `target` is `lists`, the required scopes are `list_configuration:read-write`. supported token levels: `workspace`, `user`."
                    }
                ]
            },
            {
                displayName: "Target",
                name: "target",
                type: "options",
                default: "objects",
                required: true,
                placeholder: "e.g. lists",
                options: [
                    {
                        name: "Lists",
                        value: "lists"
                    },
                    {
                        name: "Objects",
                        value: "objects"
                    }
                ],
                displayOptions: {
                    show: {
                        resource: [
                            "attributes"
                        ],
                        operation: [
                            "getV2TargetIdentifierAttributes"
                        ]
                    }
                }
            },
            {
                displayName: "Identifier",
                name: "identifier",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. 33ebdbe9-e529-47c9-b894-0ba25e9c15c0",
                displayOptions: {
                    show: {
                        resource: [
                            "attributes"
                        ],
                        operation: [
                            "getV2TargetIdentifierAttributes"
                        ]
                    }
                }
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "attributes"
                        ],
                        operation: [
                            "getV2TargetIdentifierAttributes"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Limit",
                        name: "limit",
                        type: "number",
                        default: 50,
                        description: "Max number of results to return",
                        placeholder: "e.g. 10",
                        typeOptions: {
                            minValue: 1
                        }
                    },
                    {
                        displayName: "Offset",
                        name: "offset",
                        type: "number",
                        default: 0,
                        placeholder: "e.g. 5"
                    },
                    {
                        displayName: "Show Archived",
                        name: "show_archived",
                        type: "boolean",
                        default: false,
                        description: "Whether to enable show archived",
                        placeholder: "e.g. true"
                    }
                ]
            },
            {
                displayName: "Target",
                name: "target",
                type: "options",
                default: "objects",
                required: true,
                placeholder: "e.g. lists",
                options: [
                    {
                        name: "Lists",
                        value: "lists"
                    },
                    {
                        name: "Objects",
                        value: "objects"
                    }
                ],
                displayOptions: {
                    show: {
                        resource: [
                            "attributes"
                        ],
                        operation: [
                            "getV2TargetIdentifierAttributesAttribute"
                        ]
                    }
                }
            },
            {
                displayName: "Identifier",
                name: "identifier",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. 33ebdbe9-e529-47c9-b894-0ba25e9c15c0",
                displayOptions: {
                    show: {
                        resource: [
                            "attributes"
                        ],
                        operation: [
                            "getV2TargetIdentifierAttributesAttribute"
                        ]
                    }
                }
            },
            {
                displayName: "Attribute",
                name: "attribute",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. 41252299-f8c7-4b5e-99c9-4ff8321d2f96",
                displayOptions: {
                    show: {
                        resource: [
                            "attributes"
                        ],
                        operation: [
                            "getV2TargetIdentifierAttributesAttribute"
                        ]
                    }
                }
            },
            {
                displayName: "Target",
                name: "target",
                type: "options",
                default: "objects",
                required: true,
                placeholder: "e.g. lists",
                options: [
                    {
                        name: "Lists",
                        value: "lists"
                    },
                    {
                        name: "Objects",
                        value: "objects"
                    }
                ],
                displayOptions: {
                    show: {
                        resource: [
                            "attributes"
                        ],
                        operation: [
                            "getV2TargetIdentifierAttributesAttributeOptions"
                        ]
                    }
                }
            },
            {
                displayName: "Identifier",
                name: "identifier",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. 33ebdbe9-e529-47c9-b894-0ba25e9c15c0",
                displayOptions: {
                    show: {
                        resource: [
                            "attributes"
                        ],
                        operation: [
                            "getV2TargetIdentifierAttributesAttributeOptions"
                        ]
                    }
                }
            },
            {
                displayName: "Attribute",
                name: "attribute",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. 41252299-f8c7-4b5e-99c9-4ff8321d2f96",
                displayOptions: {
                    show: {
                        resource: [
                            "attributes"
                        ],
                        operation: [
                            "getV2TargetIdentifierAttributesAttributeOptions"
                        ]
                    }
                }
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "attributes"
                        ],
                        operation: [
                            "getV2TargetIdentifierAttributesAttributeOptions"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Show Archived",
                        name: "show_archived",
                        type: "boolean",
                        default: false,
                        description: "Whether to enable show archived",
                        placeholder: "e.g. true"
                    }
                ]
            },
            {
                displayName: "Target",
                name: "target",
                type: "options",
                default: "lists",
                required: true,
                placeholder: "e.g. lists",
                options: [
                    {
                        name: "Lists",
                        value: "lists"
                    },
                    {
                        name: "Objects",
                        value: "objects"
                    }
                ],
                displayOptions: {
                    show: {
                        resource: [
                            "attributes"
                        ],
                        operation: [
                            "getV2TargetIdentifierAttributesAttributeStatuses"
                        ]
                    }
                }
            },
            {
                displayName: "Identifier",
                name: "identifier",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. 33ebdbe9-e529-47c9-b894-0ba25e9c15c0",
                displayOptions: {
                    show: {
                        resource: [
                            "attributes"
                        ],
                        operation: [
                            "getV2TargetIdentifierAttributesAttributeStatuses"
                        ]
                    }
                }
            },
            {
                displayName: "Attribute",
                name: "attribute",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. 41252299-f8c7-4b5e-99c9-4ff8321d2f96",
                displayOptions: {
                    show: {
                        resource: [
                            "attributes"
                        ],
                        operation: [
                            "getV2TargetIdentifierAttributesAttributeStatuses"
                        ]
                    }
                }
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "attributes"
                        ],
                        operation: [
                            "getV2TargetIdentifierAttributesAttributeStatuses"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Show Archived",
                        name: "show_archived",
                        type: "boolean",
                        default: false,
                        description: "Whether to enable show archived",
                        placeholder: "e.g. true"
                    }
                ]
            },
            {
                displayName: "Target",
                name: "target",
                type: "options",
                default: "objects",
                required: true,
                placeholder: "e.g. lists",
                options: [
                    {
                        name: "Lists",
                        value: "lists"
                    },
                    {
                        name: "Objects",
                        value: "objects"
                    }
                ],
                displayOptions: {
                    show: {
                        resource: [
                            "attributes"
                        ],
                        operation: [
                            "patchV2TargetIdentifierAttributesAttribute"
                        ]
                    }
                }
            },
            {
                displayName: "Identifier",
                name: "identifier",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. 33ebdbe9-e529-47c9-b894-0ba25e9c15c0",
                displayOptions: {
                    show: {
                        resource: [
                            "attributes"
                        ],
                        operation: [
                            "patchV2TargetIdentifierAttributesAttribute"
                        ]
                    }
                }
            },
            {
                displayName: "Attribute",
                name: "attribute",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. 41252299-f8c7-4b5e-99c9-4ff8321d2f96",
                displayOptions: {
                    show: {
                        resource: [
                            "attributes"
                        ],
                        operation: [
                            "patchV2TargetIdentifierAttributesAttribute"
                        ]
                    }
                }
            },
            {
                displayName: "Data",
                name: "data",
                type: "collection",
                default: {},
                placeholder: "Add Field",
                options: [
                    {
                        displayName: "API Slug",
                        name: "api_slug",
                        type: "string",
                        default: "",
                        description: "A unique, human-readable slug to access the attribute through URLs and API calls. formatted in snake case.",
                        placeholder: "e.g. my_attribute"
                    },
                    {
                        displayName: "Config",
                        name: "config",
                        type: "collection",
                        default: {},
                        placeholder: "Add Field",
                        options: [
                            {
                                displayName: "Currency",
                                name: "currency",
                                type: "collection",
                                default: {
                                    default_currency_code: "ARS",
                                    display_type: "code"
                                },
                                placeholder: "Add Field",
                                options: [
                                    {
                                        displayName: "Default Currency Code",
                                        name: "default_currency_code",
                                        type: "options",
                                        default: "ARS",
                                        description: "The iso4217 code representing the currency that values for this attribute should be stored in",
                                        placeholder: "e.g. USD",
                                        options: [
                                            {
                                                name: "AED",
                                                value: "AED"
                                            },
                                            {
                                                name: "ARS",
                                                value: "ARS"
                                            },
                                            {
                                                name: "AUD",
                                                value: "AUD"
                                            },
                                            {
                                                name: "BGN",
                                                value: "BGN"
                                            },
                                            {
                                                name: "BRL",
                                                value: "BRL"
                                            },
                                            {
                                                name: "CAD",
                                                value: "CAD"
                                            },
                                            {
                                                name: "CHF",
                                                value: "CHF"
                                            },
                                            {
                                                name: "CLP",
                                                value: "CLP"
                                            },
                                            {
                                                name: "CNY",
                                                value: "CNY"
                                            },
                                            {
                                                name: "COP",
                                                value: "COP"
                                            },
                                            {
                                                name: "CZK",
                                                value: "CZK"
                                            },
                                            {
                                                name: "DKK",
                                                value: "DKK"
                                            },
                                            {
                                                name: "EGP",
                                                value: "EGP"
                                            },
                                            {
                                                name: "EUR",
                                                value: "EUR"
                                            },
                                            {
                                                name: "FJD",
                                                value: "FJD"
                                            },
                                            {
                                                name: "GBP",
                                                value: "GBP"
                                            },
                                            {
                                                name: "GHS",
                                                value: "GHS"
                                            },
                                            {
                                                name: "HKD",
                                                value: "HKD"
                                            },
                                            {
                                                name: "HUF",
                                                value: "HUF"
                                            },
                                            {
                                                name: "IDR",
                                                value: "IDR"
                                            },
                                            {
                                                name: "ILS",
                                                value: "ILS"
                                            },
                                            {
                                                name: "INR",
                                                value: "INR"
                                            },
                                            {
                                                name: "ISK",
                                                value: "ISK"
                                            },
                                            {
                                                name: "JPY",
                                                value: "JPY"
                                            },
                                            {
                                                name: "KES",
                                                value: "KES"
                                            },
                                            {
                                                name: "KRW",
                                                value: "KRW"
                                            },
                                            {
                                                name: "MXN",
                                                value: "MXN"
                                            },
                                            {
                                                name: "MYR",
                                                value: "MYR"
                                            },
                                            {
                                                name: "NGN",
                                                value: "NGN"
                                            },
                                            {
                                                name: "NOK",
                                                value: "NOK"
                                            },
                                            {
                                                name: "NTD",
                                                value: "NTD"
                                            },
                                            {
                                                name: "NZD",
                                                value: "NZD"
                                            },
                                            {
                                                name: "OMR",
                                                value: "OMR"
                                            },
                                            {
                                                name: "PEN",
                                                value: "PEN"
                                            },
                                            {
                                                name: "PHP",
                                                value: "PHP"
                                            },
                                            {
                                                name: "PLN",
                                                value: "PLN"
                                            },
                                            {
                                                name: "QAR",
                                                value: "QAR"
                                            },
                                            {
                                                name: "RWF",
                                                value: "RWF"
                                            },
                                            {
                                                name: "SAR",
                                                value: "SAR"
                                            },
                                            {
                                                name: "SEK",
                                                value: "SEK"
                                            },
                                            {
                                                name: "SGD",
                                                value: "SGD"
                                            },
                                            {
                                                name: "THB",
                                                value: "THB"
                                            },
                                            {
                                                name: "TRY",
                                                value: "TRY"
                                            },
                                            {
                                                name: "USD",
                                                value: "USD"
                                            },
                                            {
                                                name: "UYU",
                                                value: "UYU"
                                            },
                                            {
                                                name: "XPF",
                                                value: "XPF"
                                            },
                                            {
                                                name: "ZAR",
                                                value: "ZAR"
                                            }
                                        ]
                                    },
                                    {
                                        displayName: "Display Type",
                                        name: "display_type",
                                        type: "options",
                                        default: "code",
                                        description: "How the currency should be displayed across the app. \"code\" will display the ISO currency code e.g. \"usd\", \"name\" will display the localized currency name e.g. \"british pound\", \"narrowsymbol\" will display \"$1\" instead of \"us$1\" and \"symbol\" will display a localized currency symbol such as \"$\".",
                                        placeholder: "e.g. symbol",
                                        options: [
                                            {
                                                name: "Code",
                                                value: "code"
                                            },
                                            {
                                                name: "Name",
                                                value: "name"
                                            },
                                            {
                                                name: "NarrowSymbol",
                                                value: "narrowSymbol"
                                            },
                                            {
                                                name: "Symbol",
                                                value: "symbol"
                                            }
                                        ]
                                    }
                                ],
                                description: "Configuration available for attributes of type \"currency\""
                            },
                            {
                                displayName: "Record Reference",
                                name: "record_reference",
                                type: "collection",
                                default: {
                                    allowed_objects: []
                                },
                                placeholder: "Add Field",
                                options: [
                                    {
                                        displayName: "Allowed Objects",
                                        name: "allowed_objects",
                                        type: "json",
                                        default: [],
                                        description: "A list of slugs or uuids to indicate which objects records are allowed to belong to. if `relationship` is also provided, this must contain only the relationship object."
                                    }
                                ],
                                description: "Configuration available for attributes of type \"record-reference\""
                            }
                        ],
                        description: "Additional, type-dependent configuration for the attribute"
                    },
                    {
                        displayName: "Default Value",
                        name: "default_value",
                        type: "json",
                        default: {
                            schemaAlternative: "alternative1",
                            value: ""
                        },
                        description: "Default value for the attribute. static defaults use the supplied value; dynamic defaults resolve at creation time. supported defaults depend on the attribute type. default values are unavailable on people and company objects.",
                        placeholder: "e.g. [object Object]"
                    },
                    {
                        displayName: "Description",
                        name: "description",
                        type: "string",
                        default: "",
                        description: "A text description for the attribute",
                        placeholder: "e.g. Lorem ipsum"
                    },
                    {
                        displayName: "Is Archived",
                        name: "is_archived",
                        type: "boolean",
                        default: false,
                        description: "Whether the attribute has been archived or not. see our archiving guide for more information on archiving.",
                        placeholder: "e.g. false"
                    },
                    {
                        displayName: "Is Required",
                        name: "is_required",
                        type: "boolean",
                        default: false,
                        description: "Whether when `is_required` is `true`, new records/entries must have a value for this attribute. if `false`, values may be `null`. this value does not affect existing data and you do not need to backfill `null` values if changing `is_required` from `false` to `true`.",
                        placeholder: "e.g. true"
                    },
                    {
                        displayName: "Is Unique",
                        name: "is_unique",
                        type: "boolean",
                        default: false,
                        description: "Whether or not new values for this attribute must be unique. uniqueness restrictions are only applied to new data and do not apply retroactively to previously created data.",
                        placeholder: "e.g. true"
                    },
                    {
                        displayName: "Title",
                        name: "title",
                        type: "string",
                        default: "",
                        description: "The name of the attribute. the title will be visible across attio's UI.",
                        placeholder: "e.g. Your Attribute"
                    }
                ],
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "attributes"
                        ],
                        operation: [
                            "patchV2TargetIdentifierAttributesAttribute"
                        ]
                    }
                }
            },
            {
                displayName: "Target",
                name: "target",
                type: "options",
                default: "objects",
                required: true,
                placeholder: "e.g. lists",
                options: [
                    {
                        name: "Lists",
                        value: "lists"
                    },
                    {
                        name: "Objects",
                        value: "objects"
                    }
                ],
                displayOptions: {
                    show: {
                        resource: [
                            "attributes"
                        ],
                        operation: [
                            "patchV2TargetIdentifierAttributesAttributeOptionsOption"
                        ]
                    }
                }
            },
            {
                displayName: "Identifier",
                name: "identifier",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. 33ebdbe9-e529-47c9-b894-0ba25e9c15c0",
                displayOptions: {
                    show: {
                        resource: [
                            "attributes"
                        ],
                        operation: [
                            "patchV2TargetIdentifierAttributesAttributeOptionsOption"
                        ]
                    }
                }
            },
            {
                displayName: "Attribute",
                name: "attribute",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. 41252299-f8c7-4b5e-99c9-4ff8321d2f96",
                displayOptions: {
                    show: {
                        resource: [
                            "attributes"
                        ],
                        operation: [
                            "patchV2TargetIdentifierAttributesAttributeOptionsOption"
                        ]
                    }
                }
            },
            {
                displayName: "Option",
                name: "option",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. Medium",
                displayOptions: {
                    show: {
                        resource: [
                            "attributes"
                        ],
                        operation: [
                            "patchV2TargetIdentifierAttributesAttributeOptionsOption"
                        ]
                    }
                }
            },
            {
                displayName: "Data",
                name: "data",
                type: "collection",
                default: {},
                placeholder: "Add Field",
                options: [
                    {
                        displayName: "Is Archived",
                        name: "is_archived",
                        type: "boolean",
                        default: false,
                        description: "Whether or not to archive the select option. see our archiving guide for more information on archiving.",
                        placeholder: "e.g. false"
                    },
                    {
                        displayName: "Title",
                        name: "title",
                        type: "string",
                        default: "",
                        description: "The title of the select option",
                        placeholder: "e.g. Medium"
                    }
                ],
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "attributes"
                        ],
                        operation: [
                            "patchV2TargetIdentifierAttributesAttributeOptionsOption"
                        ]
                    }
                }
            },
            {
                displayName: "Target",
                name: "target",
                type: "options",
                default: "lists",
                required: true,
                placeholder: "e.g. lists",
                options: [
                    {
                        name: "Lists",
                        value: "lists"
                    },
                    {
                        name: "Objects",
                        value: "objects"
                    }
                ],
                displayOptions: {
                    show: {
                        resource: [
                            "attributes"
                        ],
                        operation: [
                            "patchV2TargetIdentifierAttributesAttributeStatusesStatus"
                        ]
                    }
                }
            },
            {
                displayName: "Identifier",
                name: "identifier",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. 33ebdbe9-e529-47c9-b894-0ba25e9c15c0",
                displayOptions: {
                    show: {
                        resource: [
                            "attributes"
                        ],
                        operation: [
                            "patchV2TargetIdentifierAttributesAttributeStatusesStatus"
                        ]
                    }
                }
            },
            {
                displayName: "Attribute",
                name: "attribute",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. 41252299-f8c7-4b5e-99c9-4ff8321d2f96",
                displayOptions: {
                    show: {
                        resource: [
                            "attributes"
                        ],
                        operation: [
                            "patchV2TargetIdentifierAttributesAttributeStatusesStatus"
                        ]
                    }
                }
            },
            {
                displayName: "Status",
                name: "status",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. In Progress",
                displayOptions: {
                    show: {
                        resource: [
                            "attributes"
                        ],
                        operation: [
                            "patchV2TargetIdentifierAttributesAttributeStatusesStatus"
                        ]
                    }
                }
            },
            {
                displayName: "Data",
                name: "data",
                type: "collection",
                default: {},
                placeholder: "Add Field",
                options: [
                    {
                        displayName: "Celebration Enabled",
                        name: "celebration_enabled",
                        type: "boolean",
                        default: false,
                        description: "Whether arriving at this status triggers a celebration effect",
                        placeholder: "e.g. true"
                    },
                    {
                        displayName: "Is Archived",
                        name: "is_archived",
                        type: "boolean",
                        default: false,
                        description: "Whether or not to archive the status. see our archiving guide for more information on archiving.",
                        placeholder: "e.g. false"
                    },
                    {
                        displayName: "Target Time In Status",
                        name: "target_time_in_status",
                        type: "string",
                        default: "",
                        description: "Target time for a record to spend in given status expressed as a ISO-8601 duration string",
                        placeholder: "e.g. P0Y0M1DT0H0M0S",
                        hint: "Expected format: P(?:(\\d+Y)?(\\d+M)?(\\d+W)?(\\d+D)?(?:T(\\d+(?:[\\.,]\\d+)?H)?(\\d+(?:[\\.,]\\d+)?M)?(\\d+(?:[\\.,]\\d+)?S)?)?)"
                    },
                    {
                        displayName: "Title",
                        name: "title",
                        type: "string",
                        default: "",
                        description: "The title of the status",
                        placeholder: "e.g. In Progress"
                    }
                ],
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "attributes"
                        ],
                        operation: [
                            "patchV2TargetIdentifierAttributesAttributeStatusesStatus"
                        ]
                    }
                }
            },
            {
                displayName: "Target",
                name: "target",
                type: "options",
                default: "objects",
                required: true,
                placeholder: "e.g. lists",
                options: [
                    {
                        name: "Lists",
                        value: "lists"
                    },
                    {
                        name: "Objects",
                        value: "objects"
                    }
                ],
                displayOptions: {
                    show: {
                        resource: [
                            "attributes"
                        ],
                        operation: [
                            "postV2TargetIdentifierAttributes"
                        ]
                    }
                }
            },
            {
                displayName: "Identifier",
                name: "identifier",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. 97052eb9-e65e-443f-a297-f2d9a4a7f795",
                displayOptions: {
                    show: {
                        resource: [
                            "attributes"
                        ],
                        operation: [
                            "postV2TargetIdentifierAttributes"
                        ]
                    }
                }
            },
            {
                displayName: "Data",
                name: "data",
                type: "collection",
                default: {
                    api_slug: "",
                    config: {},
                    description: "",
                    is_multiselect: false,
                    is_required: false,
                    is_unique: false,
                    title: "",
                    type: "text"
                },
                placeholder: "Add Field",
                options: [
                    {
                        displayName: "API Slug",
                        name: "api_slug",
                        type: "string",
                        default: "",
                        description: "A unique, human-readable slug to access the attribute through URLs and API calls. formatted in snake case.",
                        placeholder: "e.g. my_attribute"
                    },
                    {
                        displayName: "Config",
                        name: "config",
                        type: "collection",
                        default: {},
                        placeholder: "Add Field",
                        options: [
                            {
                                displayName: "Currency",
                                name: "currency",
                                type: "collection",
                                default: {
                                    default_currency_code: "ARS",
                                    display_type: "code"
                                },
                                placeholder: "Add Field",
                                options: [
                                    {
                                        displayName: "Default Currency Code",
                                        name: "default_currency_code",
                                        type: "options",
                                        default: "ARS",
                                        description: "The iso4217 code representing the currency that values for this attribute should be stored in",
                                        placeholder: "e.g. USD",
                                        options: [
                                            {
                                                name: "AED",
                                                value: "AED"
                                            },
                                            {
                                                name: "ARS",
                                                value: "ARS"
                                            },
                                            {
                                                name: "AUD",
                                                value: "AUD"
                                            },
                                            {
                                                name: "BGN",
                                                value: "BGN"
                                            },
                                            {
                                                name: "BRL",
                                                value: "BRL"
                                            },
                                            {
                                                name: "CAD",
                                                value: "CAD"
                                            },
                                            {
                                                name: "CHF",
                                                value: "CHF"
                                            },
                                            {
                                                name: "CLP",
                                                value: "CLP"
                                            },
                                            {
                                                name: "CNY",
                                                value: "CNY"
                                            },
                                            {
                                                name: "COP",
                                                value: "COP"
                                            },
                                            {
                                                name: "CZK",
                                                value: "CZK"
                                            },
                                            {
                                                name: "DKK",
                                                value: "DKK"
                                            },
                                            {
                                                name: "EGP",
                                                value: "EGP"
                                            },
                                            {
                                                name: "EUR",
                                                value: "EUR"
                                            },
                                            {
                                                name: "FJD",
                                                value: "FJD"
                                            },
                                            {
                                                name: "GBP",
                                                value: "GBP"
                                            },
                                            {
                                                name: "GHS",
                                                value: "GHS"
                                            },
                                            {
                                                name: "HKD",
                                                value: "HKD"
                                            },
                                            {
                                                name: "HUF",
                                                value: "HUF"
                                            },
                                            {
                                                name: "IDR",
                                                value: "IDR"
                                            },
                                            {
                                                name: "ILS",
                                                value: "ILS"
                                            },
                                            {
                                                name: "INR",
                                                value: "INR"
                                            },
                                            {
                                                name: "ISK",
                                                value: "ISK"
                                            },
                                            {
                                                name: "JPY",
                                                value: "JPY"
                                            },
                                            {
                                                name: "KES",
                                                value: "KES"
                                            },
                                            {
                                                name: "KRW",
                                                value: "KRW"
                                            },
                                            {
                                                name: "MXN",
                                                value: "MXN"
                                            },
                                            {
                                                name: "MYR",
                                                value: "MYR"
                                            },
                                            {
                                                name: "NGN",
                                                value: "NGN"
                                            },
                                            {
                                                name: "NOK",
                                                value: "NOK"
                                            },
                                            {
                                                name: "NTD",
                                                value: "NTD"
                                            },
                                            {
                                                name: "NZD",
                                                value: "NZD"
                                            },
                                            {
                                                name: "OMR",
                                                value: "OMR"
                                            },
                                            {
                                                name: "PEN",
                                                value: "PEN"
                                            },
                                            {
                                                name: "PHP",
                                                value: "PHP"
                                            },
                                            {
                                                name: "PLN",
                                                value: "PLN"
                                            },
                                            {
                                                name: "QAR",
                                                value: "QAR"
                                            },
                                            {
                                                name: "RWF",
                                                value: "RWF"
                                            },
                                            {
                                                name: "SAR",
                                                value: "SAR"
                                            },
                                            {
                                                name: "SEK",
                                                value: "SEK"
                                            },
                                            {
                                                name: "SGD",
                                                value: "SGD"
                                            },
                                            {
                                                name: "THB",
                                                value: "THB"
                                            },
                                            {
                                                name: "TRY",
                                                value: "TRY"
                                            },
                                            {
                                                name: "USD",
                                                value: "USD"
                                            },
                                            {
                                                name: "UYU",
                                                value: "UYU"
                                            },
                                            {
                                                name: "XPF",
                                                value: "XPF"
                                            },
                                            {
                                                name: "ZAR",
                                                value: "ZAR"
                                            }
                                        ]
                                    },
                                    {
                                        displayName: "Display Type",
                                        name: "display_type",
                                        type: "options",
                                        default: "code",
                                        description: "How the currency should be displayed across the app. \"code\" will display the ISO currency code e.g. \"usd\", \"name\" will display the localized currency name e.g. \"british pound\", \"narrowsymbol\" will display \"$1\" instead of \"us$1\" and \"symbol\" will display a localized currency symbol such as \"$\".",
                                        placeholder: "e.g. symbol",
                                        options: [
                                            {
                                                name: "Code",
                                                value: "code"
                                            },
                                            {
                                                name: "Name",
                                                value: "name"
                                            },
                                            {
                                                name: "NarrowSymbol",
                                                value: "narrowSymbol"
                                            },
                                            {
                                                name: "Symbol",
                                                value: "symbol"
                                            }
                                        ]
                                    }
                                ],
                                description: "Configuration available for attributes of type \"currency\""
                            },
                            {
                                displayName: "Record Reference",
                                name: "record_reference",
                                type: "collection",
                                default: {
                                    allowed_objects: []
                                },
                                placeholder: "Add Field",
                                options: [
                                    {
                                        displayName: "Allowed Objects",
                                        name: "allowed_objects",
                                        type: "json",
                                        default: [],
                                        description: "A list of slugs or uuids to indicate which objects records are allowed to belong to. if `relationship` is also provided, this must contain only the relationship object."
                                    }
                                ],
                                description: "Configuration available for attributes of type \"record-reference\""
                            }
                        ]
                    },
                    {
                        displayName: "Default Value",
                        name: "default_value",
                        type: "json",
                        default: {
                            schemaAlternative: "alternative1",
                            value: ""
                        },
                        description: "Default value for the attribute. static defaults use the supplied value; dynamic defaults resolve at creation time. supported defaults depend on the attribute type. default values are unavailable on people and company objects.",
                        placeholder: "e.g. [object Object]"
                    },
                    {
                        displayName: "Description",
                        name: "description",
                        type: "string",
                        default: "",
                        description: "A text description for the attribute",
                        placeholder: "e.g. Lorem ipsum"
                    },
                    {
                        displayName: "Is Multiselect",
                        name: "is_multiselect",
                        type: "boolean",
                        default: false,
                        description: "Whether or not this attribute can have multiple values. multiselect is only available on some value types.",
                        placeholder: "e.g. true"
                    },
                    {
                        displayName: "Is Required",
                        name: "is_required",
                        type: "boolean",
                        default: false,
                        description: "Whether when `is_required` is `true`, new records/entries must have a value for this attribute. if `false`, values may be `null`. this value does not affect existing data and you do not need to backfill `null` values if changing `is_required` from `false` to `true`.",
                        placeholder: "e.g. true"
                    },
                    {
                        displayName: "Is Unique",
                        name: "is_unique",
                        type: "boolean",
                        default: false,
                        description: "Whether or not new values for this attribute must be unique. uniqueness restrictions are only applied to new data and do not apply retroactively to previously created data.",
                        placeholder: "e.g. true"
                    },
                    {
                        displayName: "Relationship",
                        name: "relationship",
                        type: "json",
                        default: {},
                        description: "Optional relationship configuration. when provided, creates a bidirectional relationship between two objects. can only be used with attributes of type \"record-reference\". if `config.record_reference.allowed_objects` is also provided, it must contain only the relationship object."
                    },
                    {
                        displayName: "Title",
                        name: "title",
                        type: "string",
                        default: "",
                        description: "The name of the attribute. the title will be visible across attio's UI.",
                        placeholder: "e.g. Your Attribute"
                    },
                    {
                        displayName: "Type",
                        name: "type",
                        type: "options",
                        default: "text",
                        description: "The type of the attribute. this value affects the possible `config` values.",
                        placeholder: "e.g. text",
                        options: [
                            {
                                name: "Actor Reference",
                                value: "actor-reference"
                            },
                            {
                                name: "Checkbox",
                                value: "checkbox"
                            },
                            {
                                name: "Currency",
                                value: "currency"
                            },
                            {
                                name: "Date",
                                value: "date"
                            },
                            {
                                name: "Domain",
                                value: "domain"
                            },
                            {
                                name: "Email Address",
                                value: "email-address"
                            },
                            {
                                name: "Location",
                                value: "location"
                            },
                            {
                                name: "Number",
                                value: "number"
                            },
                            {
                                name: "Phone Number",
                                value: "phone-number"
                            },
                            {
                                name: "Rating",
                                value: "rating"
                            },
                            {
                                name: "Record Reference",
                                value: "record-reference"
                            },
                            {
                                name: "Select",
                                value: "select"
                            },
                            {
                                name: "Status",
                                value: "status"
                            },
                            {
                                name: "Text",
                                value: "text"
                            },
                            {
                                name: "Timestamp",
                                value: "timestamp"
                            }
                        ]
                    }
                ],
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "attributes"
                        ],
                        operation: [
                            "postV2TargetIdentifierAttributes"
                        ]
                    }
                }
            },
            {
                displayName: "Target",
                name: "target",
                type: "options",
                default: "objects",
                required: true,
                placeholder: "e.g. lists",
                options: [
                    {
                        name: "Lists",
                        value: "lists"
                    },
                    {
                        name: "Objects",
                        value: "objects"
                    }
                ],
                displayOptions: {
                    show: {
                        resource: [
                            "attributes"
                        ],
                        operation: [
                            "postV2TargetIdentifierAttributesAttributeOptions"
                        ]
                    }
                }
            },
            {
                displayName: "Identifier",
                name: "identifier",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. 33ebdbe9-e529-47c9-b894-0ba25e9c15c0",
                displayOptions: {
                    show: {
                        resource: [
                            "attributes"
                        ],
                        operation: [
                            "postV2TargetIdentifierAttributesAttributeOptions"
                        ]
                    }
                }
            },
            {
                displayName: "Attribute",
                name: "attribute",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. 41252299-f8c7-4b5e-99c9-4ff8321d2f96",
                displayOptions: {
                    show: {
                        resource: [
                            "attributes"
                        ],
                        operation: [
                            "postV2TargetIdentifierAttributesAttributeOptions"
                        ]
                    }
                }
            },
            {
                displayName: "Data",
                name: "data",
                type: "collection",
                default: {
                    title: ""
                },
                placeholder: "Add Field",
                options: [
                    {
                        displayName: "Title",
                        name: "title",
                        type: "string",
                        default: "",
                        description: "The title of the select option",
                        placeholder: "e.g. Medium"
                    }
                ],
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "attributes"
                        ],
                        operation: [
                            "postV2TargetIdentifierAttributesAttributeOptions"
                        ]
                    }
                }
            },
            {
                displayName: "Target",
                name: "target",
                type: "options",
                default: "lists",
                required: true,
                placeholder: "e.g. lists",
                options: [
                    {
                        name: "Lists",
                        value: "lists"
                    },
                    {
                        name: "Objects",
                        value: "objects"
                    }
                ],
                displayOptions: {
                    show: {
                        resource: [
                            "attributes"
                        ],
                        operation: [
                            "postV2TargetIdentifierAttributesAttributeStatuses"
                        ]
                    }
                }
            },
            {
                displayName: "Identifier",
                name: "identifier",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. 33ebdbe9-e529-47c9-b894-0ba25e9c15c0",
                displayOptions: {
                    show: {
                        resource: [
                            "attributes"
                        ],
                        operation: [
                            "postV2TargetIdentifierAttributesAttributeStatuses"
                        ]
                    }
                }
            },
            {
                displayName: "Attribute",
                name: "attribute",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. 41252299-f8c7-4b5e-99c9-4ff8321d2f96",
                displayOptions: {
                    show: {
                        resource: [
                            "attributes"
                        ],
                        operation: [
                            "postV2TargetIdentifierAttributesAttributeStatuses"
                        ]
                    }
                }
            },
            {
                displayName: "Data",
                name: "data",
                type: "collection",
                default: {
                    title: ""
                },
                placeholder: "Add Field",
                options: [
                    {
                        displayName: "Celebration Enabled",
                        name: "celebration_enabled",
                        type: "boolean",
                        default: false,
                        description: "Whether arriving at this status triggers a celebration effect",
                        placeholder: "e.g. true"
                    },
                    {
                        displayName: "Target Time In Status",
                        name: "target_time_in_status",
                        type: "string",
                        default: "",
                        description: "Target time for a record to spend in given status expressed as a ISO-8601 duration string",
                        placeholder: "e.g. P0Y0M1DT0H0M0S",
                        hint: "Expected format: P(?:(\\d+Y)?(\\d+M)?(\\d+W)?(\\d+D)?(?:T(\\d+(?:[\\.,]\\d+)?H)?(\\d+(?:[\\.,]\\d+)?M)?(\\d+(?:[\\.,]\\d+)?S)?)?)"
                    },
                    {
                        displayName: "Title",
                        name: "title",
                        type: "string",
                        default: "",
                        description: "The title of the status",
                        placeholder: "e.g. In Progress"
                    }
                ],
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "attributes"
                        ],
                        operation: [
                            "postV2TargetIdentifierAttributesAttributeStatuses"
                        ]
                    }
                }
            },
            {
                displayName: "Operation",
                name: "operation",
                type: "options",
                noDataExpression: true,
                displayOptions: {
                    show: {
                        resource: [
                            "callRecordings"
                        ]
                    }
                },
                default: "deleteV2MeetingsMeetingIdCallRecordingsCallRecordingId",
                options: [
                    {
                        name: "Create",
                        value: "postV2MeetingsMeetingIdCallRecordings",
                        action: "Create call recording",
                        description: "Create a call recording for a meeting. supply a transcript for summaries and transcript-derived features; video_url is optional. limited to one request per second."
                    },
                    {
                        name: "Delete",
                        value: "deleteV2MeetingsMeetingIdCallRecordingsCallRecordingId",
                        action: "Delete call recording",
                        description: "Delete a call recording and all associated data"
                    },
                    {
                        name: "Get",
                        value: "getV2MeetingsMeetingIdCallRecordingsCallRecordingId",
                        action: "Get call recording",
                        description: "Get a single call recording by ID. this endpoint is in beta. we will aim to avoid breaking changes, but small updates may be made as we roll out to more users. required scopes: `meeting:read`, `call_recording:read`. supported token levels: `workspace`, `user`."
                    },
                    {
                        name: "List",
                        value: "getV2MeetingsMeetingIdCallRecordings",
                        action: "List call recordings",
                        description: "List all call recordings for a meeting. this endpoint is in beta. we will aim to avoid breaking changes, but small updates may be made as we roll out to more users. required scopes: `meeting:read`, `call_recording:read`. supported token levels: `workspace`, `user`."
                    }
                ]
            },
            {
                displayName: "Meeting ID",
                name: "meeting_id",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. cb59ab17-ad15-460c-a126-0715617c0853",
                hint: "Expected format: uuid",
                displayOptions: {
                    show: {
                        resource: [
                            "callRecordings"
                        ],
                        operation: [
                            "deleteV2MeetingsMeetingIdCallRecordingsCallRecordingId"
                        ]
                    }
                }
            },
            {
                displayName: "Call Recording ID",
                name: "call_recording_id",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. e8f2a3b7-9b4d-4c5e-8a1f-3d7b2c5e8f9a",
                hint: "Expected format: uuid",
                displayOptions: {
                    show: {
                        resource: [
                            "callRecordings"
                        ],
                        operation: [
                            "deleteV2MeetingsMeetingIdCallRecordingsCallRecordingId"
                        ]
                    }
                }
            },
            {
                displayName: "Meeting ID",
                name: "meeting_id",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. cb59ab17-ad15-460c-a126-0715617c0853",
                hint: "Expected format: uuid",
                displayOptions: {
                    show: {
                        resource: [
                            "callRecordings"
                        ],
                        operation: [
                            "getV2MeetingsMeetingIdCallRecordings"
                        ]
                    }
                }
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "callRecordings"
                        ],
                        operation: [
                            "getV2MeetingsMeetingIdCallRecordings"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Cursor",
                        name: "cursor",
                        type: "string",
                        default: "",
                        placeholder: "e.g. eyJkZXNjcmlwdGlvbiI6ICJ0aGlzIGlzIGEgY3Vyc29yIn0=.eM56CGbqZ6G1NHiJchTIkH4vKDr"
                    },
                    {
                        displayName: "Limit",
                        name: "limit",
                        type: "number",
                        default: 50,
                        description: "Max number of results to return",
                        placeholder: "e.g. 50",
                        typeOptions: {
                            minValue: 1
                        }
                    }
                ]
            },
            {
                displayName: "Meeting ID",
                name: "meeting_id",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. cb59ab17-ad15-460c-a126-0715617c0853",
                hint: "Expected format: uuid",
                displayOptions: {
                    show: {
                        resource: [
                            "callRecordings"
                        ],
                        operation: [
                            "getV2MeetingsMeetingIdCallRecordingsCallRecordingId"
                        ]
                    }
                }
            },
            {
                displayName: "Call Recording ID",
                name: "call_recording_id",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. e8f2a3b7-9b4d-4c5e-8a1f-3d7b2c5e8f9a",
                hint: "Expected format: uuid",
                displayOptions: {
                    show: {
                        resource: [
                            "callRecordings"
                        ],
                        operation: [
                            "getV2MeetingsMeetingIdCallRecordingsCallRecordingId"
                        ]
                    }
                }
            },
            {
                displayName: "Meeting ID",
                name: "meeting_id",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. cb59ab17-ad15-460c-a126-0715617c0853",
                hint: "Expected format: uuid",
                displayOptions: {
                    show: {
                        resource: [
                            "callRecordings"
                        ],
                        operation: [
                            "postV2MeetingsMeetingIdCallRecordings"
                        ]
                    }
                }
            },
            {
                displayName: "Data",
                name: "data",
                type: "collection",
                default: {},
                placeholder: "Add Field",
                options: [
                    {
                        displayName: "Transcript",
                        name: "transcript",
                        type: "json",
                        default: [],
                        description: "Transcript text for the call recording. it is optional for compatibility but should be supplied for summaries and transcript-derived features; it may become required in a future API version."
                    },
                    {
                        displayName: "Video URL",
                        name: "video_url",
                        type: "string",
                        default: "",
                        description: "Public HTTPS URL for an mp4 call recording, up to 1 gb. attio downloads it asynchronously and checks the URL with a head request. a transcript can be submitted without a video.",
                        placeholder: "e.g. https://example.com/recording.mp4",
                        hint: "Expected format: uri"
                    }
                ],
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "callRecordings"
                        ],
                        operation: [
                            "postV2MeetingsMeetingIdCallRecordings"
                        ]
                    }
                }
            },
            {
                displayName: "Operation",
                name: "operation",
                type: "options",
                noDataExpression: true,
                displayOptions: {
                    show: {
                        resource: [
                            "emails"
                        ]
                    }
                },
                default: "getV2Emails",
                options: [
                    {
                        name: "List",
                        value: "getV2Emails",
                        action: "List emails",
                        description: "List email metadata from connected mailboxes. email content is never returned; provide at least one supported filter. multiple filters are combined with or."
                    }
                ]
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "emails"
                        ],
                        operation: [
                            "getV2Emails"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Cursor",
                        name: "cursor",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Domain",
                        name: "domain",
                        type: "string",
                        default: "",
                        placeholder: "e.g. fundstack.com"
                    },
                    {
                        displayName: "Exclude Automated Participants",
                        name: "exclude_automated_participants",
                        type: "boolean",
                        default: false,
                        description: "Whether to enable exclude automated participants",
                        placeholder: "e.g. false"
                    },
                    {
                        displayName: "Limit",
                        name: "limit",
                        type: "number",
                        default: 50,
                        description: "Max number of results to return",
                        placeholder: "e.g. 25",
                        typeOptions: {
                            minValue: 1
                        }
                    },
                    {
                        displayName: "Linked Object",
                        name: "linked_object",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Linked Record IDs",
                        name: "linked_record_ids",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Participants",
                        name: "participants",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Sent After",
                        name: "sent_after",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Sent Before",
                        name: "sent_before",
                        type: "string",
                        default: ""
                    }
                ]
            },
            {
                displayName: "Operation",
                name: "operation",
                type: "options",
                noDataExpression: true,
                displayOptions: {
                    show: {
                        resource: [
                            "entries"
                        ]
                    }
                },
                default: "deleteV2ListsListEntriesEntryId",
                options: [
                    {
                        name: "Create An Entry (Add Record To List)",
                        value: "postV2ListsListEntries",
                        action: "Create entry add record to list",
                        description: "Adds a record to a list as a new list entry. this endpoint will throw on conflicts of unique attributes. multiple list entries are allowed for the same parent record required scopes: `list_entry:read-write`, `list_configuration:read`. supported token levels: `workspace`, `user`."
                    },
                    {
                        name: "Delete A List",
                        value: "deleteV2ListsListEntriesEntryId",
                        action: "Delete list entry",
                        description: "Deletes a single list entry by its `entry_id`. required scopes: `list_entry:read-write`, `list_configuration:read`. supported token levels: `workspace`, `user`."
                    },
                    {
                        name: "Get A List",
                        value: "getV2ListsListEntriesEntryId",
                        action: "Get list entry",
                        description: "Gets a single list entry by its `entry_id`. required scopes: `list_entry:read`, `list_configuration:read`. supported token levels: `workspace`, `user`."
                    },
                    {
                        name: "List",
                        value: "postV2ListsListEntriesQuery",
                        action: "List entries",
                        description: "Lists entries in a given list, with the option to filter and sort results. required scopes: `list_entry:read`, `list_configuration:read`. supported token levels: `workspace`, `user`."
                    },
                    {
                        name: "List Attribute Values For A List",
                        value: "getV2ListsListEntriesEntryIdAttributesAttributeValues",
                        action: "List attribute values for a list entry",
                        description: "Get an attribute's values for a list entry. set show_historic to include historical values, which are returned oldest first."
                    },
                    {
                        name: "Update A List Entry (Append Multiselect Values)",
                        value: "patchV2ListsListEntriesEntryId",
                        action: "Update list entry append multiselect values",
                        description: "Update a list entry by entry_id and prepend supplied multi-select values. use put to replace existing values."
                    },
                    {
                        name: "Update A List Entry (Overwrite Multiselect Values)",
                        value: "putV2ListsListEntriesEntryId",
                        action: "Update list entry overwrite multiselect values",
                        description: "Update a list entry by entry_id. supplied multi-select values replace existing values; use patch to add values without removing existing ones."
                    },
                    {
                        name: "Upsert A List Entry By Parent",
                        value: "putV2ListsListEntries",
                        action: "Upsert list entry by parent",
                        description: "Create or update a list entry for a parent record. multiple matching entries return multiple_match_results. supplied multi-select values replace existing values."
                    },
                    {
                        name: "Write List Entry Attribute Values",
                        value: "putV2ListsListEntriesEntryIdAttributesAttributeValues",
                        action: "Write list entry attribute values",
                        description: "Replace a list-entry attribute's full value history. existing values are removed; provide at least one timestamped value. single-value intervals cannot overlap, and only one may have no end time."
                    }
                ]
            },
            {
                displayName: "List",
                name: "list",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. enterprise_sales",
                displayOptions: {
                    show: {
                        resource: [
                            "entries"
                        ],
                        operation: [
                            "deleteV2ListsListEntriesEntryId"
                        ]
                    }
                }
            },
            {
                displayName: "Entry ID",
                name: "entry_id",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. 2e6e29ea-c4e0-4f44-842d-78a891f8c156",
                hint: "Expected format: uuid",
                displayOptions: {
                    show: {
                        resource: [
                            "entries"
                        ],
                        operation: [
                            "deleteV2ListsListEntriesEntryId"
                        ]
                    }
                }
            },
            {
                displayName: "List",
                name: "list",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. 33ebdbe9-e529-47c9-b894-0ba25e9c15c0",
                displayOptions: {
                    show: {
                        resource: [
                            "entries"
                        ],
                        operation: [
                            "getV2ListsListEntriesEntryId"
                        ]
                    }
                }
            },
            {
                displayName: "Entry ID",
                name: "entry_id",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. 2e6e29ea-c4e0-4f44-842d-78a891f8c156",
                hint: "Expected format: uuid",
                displayOptions: {
                    show: {
                        resource: [
                            "entries"
                        ],
                        operation: [
                            "getV2ListsListEntriesEntryId"
                        ]
                    }
                }
            },
            {
                displayName: "List",
                name: "list",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. enterprise_sales",
                displayOptions: {
                    show: {
                        resource: [
                            "entries"
                        ],
                        operation: [
                            "getV2ListsListEntriesEntryIdAttributesAttributeValues"
                        ]
                    }
                }
            },
            {
                displayName: "Entry ID",
                name: "entry_id",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. 2e6e29ea-c4e0-4f44-842d-78a891f8c156",
                hint: "Expected format: uuid",
                displayOptions: {
                    show: {
                        resource: [
                            "entries"
                        ],
                        operation: [
                            "getV2ListsListEntriesEntryIdAttributesAttributeValues"
                        ]
                    }
                }
            },
            {
                displayName: "Attribute",
                name: "attribute",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. 41252299-f8c7-4b5e-99c9-4ff8321d2f96",
                displayOptions: {
                    show: {
                        resource: [
                            "entries"
                        ],
                        operation: [
                            "getV2ListsListEntriesEntryIdAttributesAttributeValues"
                        ]
                    }
                }
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "entries"
                        ],
                        operation: [
                            "getV2ListsListEntriesEntryIdAttributesAttributeValues"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Limit",
                        name: "limit",
                        type: "number",
                        default: 50,
                        description: "Max number of results to return",
                        placeholder: "e.g. 10",
                        typeOptions: {
                            minValue: 1
                        }
                    },
                    {
                        displayName: "Offset",
                        name: "offset",
                        type: "number",
                        default: 0,
                        placeholder: "e.g. 5"
                    },
                    {
                        displayName: "Show Historic",
                        name: "show_historic",
                        type: "boolean",
                        default: false,
                        description: "Whether to enable show historic",
                        placeholder: "e.g. true"
                    }
                ]
            },
            {
                displayName: "List",
                name: "list",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. 33ebdbe9-e529-47c9-b894-0ba25e9c15c0",
                displayOptions: {
                    show: {
                        resource: [
                            "entries"
                        ],
                        operation: [
                            "patchV2ListsListEntriesEntryId"
                        ]
                    }
                }
            },
            {
                displayName: "Entry ID",
                name: "entry_id",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. 2e6e29ea-c4e0-4f44-842d-78a891f8c156",
                displayOptions: {
                    show: {
                        resource: [
                            "entries"
                        ],
                        operation: [
                            "patchV2ListsListEntriesEntryId"
                        ]
                    }
                }
            },
            {
                displayName: "Data",
                name: "data",
                type: "collection",
                default: {
                    entry_values: {}
                },
                placeholder: "Add Field",
                options: [
                    {
                        displayName: "Entry Values",
                        name: "entry_values",
                        type: "json",
                        default: {},
                        description: "Attribute values keyed by api_slug or attribute_id. pass one value for single-select attributes or an array for multi-select values; see attio's attribute type documentation for value formats.",
                        placeholder: "e.g. [object Object]"
                    }
                ],
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "entries"
                        ],
                        operation: [
                            "patchV2ListsListEntriesEntryId"
                        ]
                    }
                }
            },
            {
                displayName: "List",
                name: "list",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. 33ebdbe9-e529-47c9-b894-0ba25e9c15c0",
                displayOptions: {
                    show: {
                        resource: [
                            "entries"
                        ],
                        operation: [
                            "postV2ListsListEntries"
                        ]
                    }
                }
            },
            {
                displayName: "Data",
                name: "data",
                type: "collection",
                default: {
                    entry_values: {},
                    parent_object: "",
                    parent_record_id: ""
                },
                placeholder: "Add Field",
                options: [
                    {
                        displayName: "Entry Values",
                        name: "entry_values",
                        type: "json",
                        default: {},
                        description: "Attribute values keyed by api_slug or attribute_id. pass one value for single-select attributes or an array for multi-select values; see attio's attribute type documentation for value formats.",
                        placeholder: "e.g. [object Object]"
                    },
                    {
                        displayName: "Parent Object",
                        name: "parent_object",
                        type: "string",
                        default: "",
                        description: "A UUID or slug identifying the object that the added parent record belongs to",
                        placeholder: "e.g. people"
                    },
                    {
                        displayName: "Parent Record ID",
                        name: "parent_record_id",
                        type: "string",
                        default: "",
                        description: "A UUID identifying the record you want to add to the list. the record will become the 'parent' of the created list entry.",
                        placeholder: "e.g. 891dcbfc-9141-415d-9b2a-2238a6cc012d",
                        hint: "Expected format: uuid"
                    }
                ],
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "entries"
                        ],
                        operation: [
                            "postV2ListsListEntries"
                        ]
                    }
                }
            },
            {
                displayName: "List",
                name: "list",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. 33ebdbe9-e529-47c9-b894-0ba25e9c15c0",
                displayOptions: {
                    show: {
                        resource: [
                            "entries"
                        ],
                        operation: [
                            "postV2ListsListEntriesQuery"
                        ]
                    }
                }
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "entries"
                        ],
                        operation: [
                            "postV2ListsListEntriesQuery"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Filter",
                        name: "filter",
                        type: "json",
                        default: {},
                        description: "An object used to filter results to a subset of results. cannot be used together with `filter_view_id`. see the full guide to filtering and sorting here.",
                        placeholder: "e.g. [object Object]"
                    },
                    {
                        displayName: "Filter View ID",
                        name: "filter_view_id",
                        type: "string",
                        default: "",
                        description: "UUID of a saved view to apply. it cannot be combined with filter; sorting, limits, and offsets remain independent, and all attributes are returned.",
                        hint: "Expected format: uuid"
                    },
                    {
                        displayName: "Limit",
                        name: "limit",
                        type: "number",
                        default: 50,
                        description: "Max number of results to return",
                        placeholder: "e.g. 500",
                        typeOptions: {
                            minValue: 1
                        }
                    },
                    {
                        displayName: "Offset",
                        name: "offset",
                        type: "number",
                        default: 0,
                        description: "The number of results to skip over before returning. defaults to 0. see the full guide to pagination here.",
                        placeholder: "e.g. 0"
                    },
                    {
                        displayName: "Sorts",
                        name: "sorts",
                        type: "json",
                        default: [],
                        description: "An object used to sort results. see the full guide to filtering and sorting here.",
                        placeholder: "e.g. [object Object]"
                    }
                ]
            },
            {
                displayName: "List",
                name: "list",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. 33ebdbe9-e529-47c9-b894-0ba25e9c15c0",
                displayOptions: {
                    show: {
                        resource: [
                            "entries"
                        ],
                        operation: [
                            "putV2ListsListEntries"
                        ]
                    }
                }
            },
            {
                displayName: "Data",
                name: "data",
                type: "collection",
                default: {
                    entry_values: {},
                    parent_object: "",
                    parent_record_id: ""
                },
                placeholder: "Add Field",
                options: [
                    {
                        displayName: "Entry Values",
                        name: "entry_values",
                        type: "json",
                        default: {},
                        description: "Attribute values keyed by api_slug or attribute_id. pass one value for single-select attributes or an array for multi-select values; see attio's attribute type documentation for value formats.",
                        placeholder: "e.g. [object Object]"
                    },
                    {
                        displayName: "Parent Object",
                        name: "parent_object",
                        type: "string",
                        default: "",
                        description: "A UUID or slug identifying the object that the added parent record belongs to",
                        placeholder: "e.g. people"
                    },
                    {
                        displayName: "Parent Record ID",
                        name: "parent_record_id",
                        type: "string",
                        default: "",
                        description: "A UUID identifying the record you want to add to the list. the record will become the 'parent' of the created list entry.",
                        placeholder: "e.g. 891dcbfc-9141-415d-9b2a-2238a6cc012d",
                        hint: "Expected format: uuid"
                    }
                ],
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "entries"
                        ],
                        operation: [
                            "putV2ListsListEntries"
                        ]
                    }
                }
            },
            {
                displayName: "List",
                name: "list",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. 33ebdbe9-e529-47c9-b894-0ba25e9c15c0",
                displayOptions: {
                    show: {
                        resource: [
                            "entries"
                        ],
                        operation: [
                            "putV2ListsListEntriesEntryId"
                        ]
                    }
                }
            },
            {
                displayName: "Entry ID",
                name: "entry_id",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. 2e6e29ea-c4e0-4f44-842d-78a891f8c156",
                displayOptions: {
                    show: {
                        resource: [
                            "entries"
                        ],
                        operation: [
                            "putV2ListsListEntriesEntryId"
                        ]
                    }
                }
            },
            {
                displayName: "Data",
                name: "data",
                type: "collection",
                default: {
                    entry_values: {}
                },
                placeholder: "Add Field",
                options: [
                    {
                        displayName: "Entry Values",
                        name: "entry_values",
                        type: "json",
                        default: {},
                        description: "Attribute values keyed by api_slug or attribute_id. pass one value for single-select attributes or an array for multi-select values; see attio's attribute type documentation for value formats.",
                        placeholder: "e.g. [object Object]"
                    }
                ],
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "entries"
                        ],
                        operation: [
                            "putV2ListsListEntriesEntryId"
                        ]
                    }
                }
            },
            {
                displayName: "List",
                name: "list",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. enterprise_sales",
                displayOptions: {
                    show: {
                        resource: [
                            "entries"
                        ],
                        operation: [
                            "putV2ListsListEntriesEntryIdAttributesAttributeValues"
                        ]
                    }
                }
            },
            {
                displayName: "Entry ID",
                name: "entry_id",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. 2e6e29ea-c4e0-4f44-842d-78a891f8c156",
                hint: "Expected format: uuid",
                displayOptions: {
                    show: {
                        resource: [
                            "entries"
                        ],
                        operation: [
                            "putV2ListsListEntriesEntryIdAttributesAttributeValues"
                        ]
                    }
                }
            },
            {
                displayName: "Attribute",
                name: "attribute",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. 41252299-f8c7-4b5e-99c9-4ff8321d2f96",
                displayOptions: {
                    show: {
                        resource: [
                            "entries"
                        ],
                        operation: [
                            "putV2ListsListEntriesEntryIdAttributesAttributeValues"
                        ]
                    }
                }
            },
            {
                displayName: "Data",
                name: "data",
                type: "collection",
                default: {
                    replace_history: true,
                    values: []
                },
                placeholder: "Add Field",
                options: [
                    {
                        displayName: "Replace History",
                        name: "replace_history",
                        type: "options",
                        default: true,
                        description: "Must be `true`. acknowledges that this request replaces the attribute's entire value history, destroying every value it currently has, including values not present in this request.",
                        options: [
                            {
                                name: "True",
                                value: true
                            }
                        ]
                    },
                    {
                        displayName: "Values",
                        name: "values",
                        type: "json",
                        default: [],
                        description: "The complete value history to write, replacing any existing values. values may be supplied in any order. gaps between intervals are allowed. at least one value is required, and a maximum of 400 values may be written in one request."
                    }
                ],
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "entries"
                        ],
                        operation: [
                            "putV2ListsListEntriesEntryIdAttributesAttributeValues"
                        ]
                    }
                }
            },
            {
                displayName: "Operation",
                name: "operation",
                type: "options",
                noDataExpression: true,
                displayOptions: {
                    show: {
                        resource: [
                            "files"
                        ]
                    }
                },
                default: "deleteV2FilesFileId",
                options: [
                    {
                        name: "Create A Folder",
                        value: "postV2Files",
                        action: "Create folder files",
                        description: "Create a native folder or a connected file/folder entry on an object record"
                    },
                    {
                        name: "Delete A",
                        value: "deleteV2FilesFileId",
                        action: "Delete file",
                        description: "Delete a file by ID. deleting a folder also deletes all descendants."
                    },
                    {
                        name: "Download A",
                        value: "getV2FilesFileIdDownload",
                        action: "Download file",
                        description: "Download a file through a redirect to a signed URL"
                    },
                    {
                        name: "Get A",
                        value: "getV2FilesFileId",
                        action: "Get file",
                        description: "Get a single file entry by ID. this endpoint is in beta. we will aim to avoid breaking changes, but small updates may be made as we roll out to more users. required scopes: `file:read`, `object_configuration:read`, `record_permission:read`. supported token levels: `workspace`, `user`."
                    },
                    {
                        name: "List",
                        value: "getV2Files",
                        action: "List files",
                        description: "List internal and connected files and folders for a record. use object and record_id to identify it; optionally filter by storage provider or parent folder."
                    },
                    {
                        name: "Upload A",
                        value: "postV2FilesUpload",
                        action: "Upload file",
                        description: "Upload a file to attio storage for a record using multipart/form-data with file, object, record_id, and optional parent_folder_id. maximum file size is 50 mb; limited to one request per second."
                    }
                ]
            },
            {
                displayName: "File ID",
                name: "file_id",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. a1b2c3d4-e5f6-7890-abcd-ef1234567890",
                hint: "Expected format: uuid",
                displayOptions: {
                    show: {
                        resource: [
                            "files"
                        ],
                        operation: [
                            "deleteV2FilesFileId"
                        ]
                    }
                }
            },
            {
                displayName: "Object",
                name: "object",
                type: "string",
                default: "",
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "files"
                        ],
                        operation: [
                            "getV2Files"
                        ]
                    }
                }
            },
            {
                displayName: "Record ID",
                name: "record_id",
                type: "string",
                default: "",
                required: true,
                hint: "Expected format: uuid",
                displayOptions: {
                    show: {
                        resource: [
                            "files"
                        ],
                        operation: [
                            "getV2Files"
                        ]
                    }
                }
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "files"
                        ],
                        operation: [
                            "getV2Files"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Cursor",
                        name: "cursor",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Limit",
                        name: "limit",
                        type: "number",
                        default: 50,
                        description: "Max number of results to return",
                        placeholder: "e.g. 50",
                        typeOptions: {
                            minValue: 1
                        }
                    },
                    {
                        displayName: "Parent Folder ID",
                        name: "parent_folder_id",
                        type: "string",
                        default: "",
                        hint: "Expected format: uuid"
                    },
                    {
                        displayName: "Storage Provider",
                        name: "storage_provider",
                        type: "options",
                        default: "attio",
                        options: [
                            {
                                name: "Attio",
                                value: "attio"
                            },
                            {
                                name: "Box",
                                value: "box"
                            },
                            {
                                name: "Dropbox",
                                value: "dropbox"
                            },
                            {
                                name: "Google Drive",
                                value: "google-drive"
                            },
                            {
                                name: "Microsoft Onedrive",
                                value: "microsoft-onedrive"
                            }
                        ]
                    }
                ]
            },
            {
                displayName: "File ID",
                name: "file_id",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. a1b2c3d4-e5f6-7890-abcd-ef1234567890",
                hint: "Expected format: uuid",
                displayOptions: {
                    show: {
                        resource: [
                            "files"
                        ],
                        operation: [
                            "getV2FilesFileId"
                        ]
                    }
                }
            },
            {
                displayName: "File ID",
                name: "file_id",
                type: "string",
                default: "",
                required: true,
                hint: "Expected format: uuid",
                displayOptions: {
                    show: {
                        resource: [
                            "files"
                        ],
                        operation: [
                            "getV2FilesFileIdDownload"
                        ]
                    }
                }
            },
            {
                displayName: "Body JSON",
                name: "bodyJson",
                type: "json",
                default: {
                    schemaAlternative: "alternative1",
                    value: ""
                },
                required: true,
                description: "Raw request body",
                displayOptions: {
                    show: {
                        resource: [
                            "files"
                        ],
                        operation: [
                            "postV2Files"
                        ]
                    }
                }
            },
            {
                displayName: "File",
                name: "file",
                type: "string",
                default: "",
                required: true,
                description: "The file to upload",
                displayOptions: {
                    show: {
                        resource: [
                            "files"
                        ],
                        operation: [
                            "postV2FilesUpload"
                        ]
                    }
                }
            },
            {
                displayName: "Object",
                name: "object",
                type: "string",
                default: "",
                required: true,
                description: "The object slug or ID",
                placeholder: "e.g. people",
                displayOptions: {
                    show: {
                        resource: [
                            "files"
                        ],
                        operation: [
                            "postV2FilesUpload"
                        ]
                    }
                }
            },
            {
                displayName: "Record ID",
                name: "record_id",
                type: "string",
                default: "",
                required: true,
                description: "The ID of the record to upload the file to",
                placeholder: "e.g. bf071e1f-6035-429d-b874-d83ea64ea13b",
                hint: "Expected format: uuid",
                displayOptions: {
                    show: {
                        resource: [
                            "files"
                        ],
                        operation: [
                            "postV2FilesUpload"
                        ]
                    }
                }
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "files"
                        ],
                        operation: [
                            "postV2FilesUpload"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Parent Folder ID",
                        name: "parent_folder_id",
                        type: "string",
                        default: "",
                        description: "Optional parent folder ID. omit to upload to the root folder.",
                        placeholder: "e.g. a1b2c3d4-e5f6-7890-abcd-ef1234567890",
                        hint: "Expected format: uuid"
                    }
                ]
            },
            {
                displayName: "Operation",
                name: "operation",
                type: "options",
                noDataExpression: true,
                displayOptions: {
                    show: {
                        resource: [
                            "lists"
                        ]
                    }
                },
                default: "getV2Lists",
                options: [
                    {
                        name: "Create A",
                        value: "postV2Lists",
                        action: "Create list",
                        description: "Create a list for a parent object and configure workspace or member access. a list must grant full access to the workspace or at least one member."
                    },
                    {
                        name: "Get A",
                        value: "getV2ListsList",
                        action: "Get list",
                        description: "Gets a single list in your workspace that your access token has access to. required scopes: `list_configuration:read`. supported token levels: `workspace`, `user`."
                    },
                    {
                        name: "List All",
                        value: "getV2Lists",
                        action: "List all lists",
                        description: "List all lists that your access token has access to. lists are returned in the order that they are sorted in the sidebar. required scopes: `list_configuration:read`. supported token levels: `workspace`, `user`."
                    },
                    {
                        name: "List Views For",
                        value: "getV2ListsListViews",
                        action: "List views for list",
                        description: "Lists saved views for a list. results are ordered by view ID (`ID.view_id` ascending). required scopes: `list_configuration:read`. supported token levels: `workspace`, `user`."
                    },
                    {
                        name: "Update A",
                        value: "patchV2ListsList",
                        action: "Update list",
                        description: "Update a list's access settings. lists must grant full access to the workspace or at least one member. the parent object cannot be changed through this endpoint."
                    }
                ]
            },
            {
                displayName: "List",
                name: "list",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. 33ebdbe9-e529-47c9-b894-0ba25e9c15c0",
                displayOptions: {
                    show: {
                        resource: [
                            "lists"
                        ],
                        operation: [
                            "getV2ListsList"
                        ]
                    }
                }
            },
            {
                displayName: "List",
                name: "list",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. 33ebdbe9-e529-47c9-b894-0ba25e9c15c0",
                displayOptions: {
                    show: {
                        resource: [
                            "lists"
                        ],
                        operation: [
                            "getV2ListsListViews"
                        ]
                    }
                }
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "lists"
                        ],
                        operation: [
                            "getV2ListsListViews"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Cursor",
                        name: "cursor",
                        type: "string",
                        default: "",
                        placeholder: "e.g. eyJkZXNjcmlwdGlvbiI6ICJ0aGlzIGlzIGEgY3Vyc29yIn0=.eM56CGbqZ6G1NHiJchTIkH4vKDr"
                    },
                    {
                        displayName: "Limit",
                        name: "limit",
                        type: "number",
                        default: 50,
                        description: "Max number of results to return",
                        placeholder: "e.g. 500",
                        typeOptions: {
                            minValue: 1
                        }
                    },
                    {
                        displayName: "Show Archived",
                        name: "show_archived",
                        type: "boolean",
                        default: false,
                        description: "Whether to enable show archived",
                        placeholder: "e.g. false"
                    }
                ]
            },
            {
                displayName: "List",
                name: "list",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. 33ebdbe9-e529-47c9-b894-0ba25e9c15c0",
                displayOptions: {
                    show: {
                        resource: [
                            "lists"
                        ],
                        operation: [
                            "patchV2ListsList"
                        ]
                    }
                }
            },
            {
                displayName: "Data",
                name: "data",
                type: "collection",
                default: {},
                placeholder: "Add Field",
                options: [
                    {
                        displayName: "API Slug",
                        name: "api_slug",
                        type: "string",
                        default: "",
                        description: "A unique, human-readable slug to access the list through API calls. should be formatted in snake case.",
                        placeholder: "e.g. enterprise_sales"
                    },
                    {
                        displayName: "Name",
                        name: "name",
                        type: "string",
                        default: "",
                        description: "The human-readable name of the list",
                        placeholder: "e.g. Enterprise Sales"
                    },
                    {
                        displayName: "Workspace Access",
                        name: "workspace_access",
                        type: "options",
                        default: "full-access",
                        description: "The level of access granted to all members of the workspace for this list. pass `null` to keep the list private and only grant access to specific workspace members.",
                        placeholder: "e.g. read-and-write",
                        options: [
                            {
                                name: "Full Access",
                                value: "full-access"
                            },
                            {
                                name: "Read And Write",
                                value: "read-and-write"
                            },
                            {
                                name: "Read Only",
                                value: "read-only"
                            }
                        ]
                    },
                    {
                        displayName: "Workspace Member Access",
                        name: "workspace_member_access",
                        type: "json",
                        default: [],
                        description: "The level of access granted to specific workspace members for this list. pass an empty array to grant access to no workspace members."
                    }
                ],
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "lists"
                        ],
                        operation: [
                            "patchV2ListsList"
                        ]
                    }
                }
            },
            {
                displayName: "Data",
                name: "data",
                type: "collection",
                default: {
                    api_slug: "",
                    name: "",
                    parent_object: "",
                    workspace_access: "full-access",
                    workspace_member_access: []
                },
                placeholder: "Add Field",
                options: [
                    {
                        displayName: "API Slug",
                        name: "api_slug",
                        type: "string",
                        default: "",
                        description: "A unique, human-readable slug to access the list through API calls. should be formatted in snake case.",
                        placeholder: "e.g. enterprise_sales"
                    },
                    {
                        displayName: "Name",
                        name: "name",
                        type: "string",
                        default: "",
                        description: "The human-readable name of the list",
                        placeholder: "e.g. Enterprise Sales"
                    },
                    {
                        displayName: "Parent Object",
                        name: "parent_object",
                        type: "string",
                        default: "",
                        description: "A UUID or slug to identify the allowed object type for records added to this list",
                        placeholder: "e.g. people"
                    },
                    {
                        displayName: "Workspace Access",
                        name: "workspace_access",
                        type: "options",
                        default: "full-access",
                        description: "The level of access granted to all members of the workspace for this list. pass `null` to keep the list private and only grant access to specific workspace members.",
                        placeholder: "e.g. read-and-write",
                        options: [
                            {
                                name: "Full Access",
                                value: "full-access"
                            },
                            {
                                name: "Read And Write",
                                value: "read-and-write"
                            },
                            {
                                name: "Read Only",
                                value: "read-only"
                            }
                        ]
                    },
                    {
                        displayName: "Workspace Member Access",
                        name: "workspace_member_access",
                        type: "json",
                        default: [],
                        description: "The level of access granted to specific workspace members for this list. pass an empty array to grant access to no workspace members."
                    }
                ],
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "lists"
                        ],
                        operation: [
                            "postV2Lists"
                        ]
                    }
                }
            },
            {
                displayName: "Operation",
                name: "operation",
                type: "options",
                noDataExpression: true,
                displayOptions: {
                    show: {
                        resource: [
                            "meetings"
                        ]
                    }
                },
                default: "deleteV2MeetingsMeetingId",
                options: [
                    {
                        name: "Create A",
                        value: "postV2Meetings",
                        action: "Create meeting",
                        description: "Create a meeting. follow attio's meeting-sync guidance to avoid duplicate meetings."
                    },
                    {
                        name: "Delete A",
                        value: "deleteV2MeetingsMeetingId",
                        action: "Delete meeting",
                        description: "Delete a meeting by ID. calendar-synced meetings cannot be deleted through the API; delete the calendar event or disconnect the calendar instead."
                    },
                    {
                        name: "Get A",
                        value: "getV2MeetingsMeetingId",
                        action: "Get meeting",
                        description: "Get a single meeting by ID. this endpoint is in beta. we will aim to avoid breaking changes, but small updates may be made as we roll out to more users. required scopes: `meeting:read`, `record_permission:read`. supported token levels: `workspace`, `user`."
                    },
                    {
                        name: "List",
                        value: "getV2Meetings",
                        action: "List meetings",
                        description: "List workspace meetings in a deterministic order. when participants and linked_record_id are both supplied, meetings matching either filter are returned."
                    },
                    {
                        name: "Update A Meeting (Append Linked Records)",
                        value: "patchV2MeetingsMeetingId",
                        action: "Update meeting append linked records",
                        description: "Add records to a meeting's existing links; linked records are ignored. use put to replace links. attio may link participant companies asynchronously."
                    },
                    {
                        name: "Update A Meeting (Overwrite Linked Records)",
                        value: "putV2MeetingsMeetingId",
                        action: "Update meeting overwrite linked records",
                        description: "Replace a meeting's linked records with the supplied records. omitted links are removed, including participant-derived links; an empty array clears all links. use patch to add links without removing existing ones."
                    }
                ]
            },
            {
                displayName: "Meeting ID",
                name: "meeting_id",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. cb59ab17-ad15-460c-a126-0715617c0853",
                hint: "Expected format: uuid",
                displayOptions: {
                    show: {
                        resource: [
                            "meetings"
                        ],
                        operation: [
                            "deleteV2MeetingsMeetingId"
                        ]
                    }
                }
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "meetings"
                        ],
                        operation: [
                            "getV2Meetings"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Cursor",
                        name: "cursor",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Ends From",
                        name: "ends_from",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Limit",
                        name: "limit",
                        type: "number",
                        default: 50,
                        description: "Max number of results to return",
                        placeholder: "e.g. 50",
                        typeOptions: {
                            minValue: 1
                        }
                    },
                    {
                        displayName: "Linked Object",
                        name: "linked_object",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Linked Record ID",
                        name: "linked_record_id",
                        type: "string",
                        default: "",
                        hint: "Expected format: uuid"
                    },
                    {
                        displayName: "Participants",
                        name: "participants",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Sort",
                        name: "sort",
                        type: "options",
                        default: "start_asc",
                        options: [
                            {
                                name: "Start Asc",
                                value: "start_asc"
                            },
                            {
                                name: "Start Desc",
                                value: "start_desc"
                            }
                        ]
                    },
                    {
                        displayName: "Starts Before",
                        name: "starts_before",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Timezone",
                        name: "timezone",
                        type: "string",
                        default: "UTC"
                    }
                ]
            },
            {
                displayName: "Meeting ID",
                name: "meeting_id",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. cb59ab17-ad15-460c-a126-0715617c0853",
                hint: "Expected format: uuid",
                displayOptions: {
                    show: {
                        resource: [
                            "meetings"
                        ],
                        operation: [
                            "getV2MeetingsMeetingId"
                        ]
                    }
                }
            },
            {
                displayName: "Meeting ID",
                name: "meeting_id",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. cb59ab17-ad15-460c-a126-0715617c0853",
                hint: "Expected format: uuid",
                displayOptions: {
                    show: {
                        resource: [
                            "meetings"
                        ],
                        operation: [
                            "patchV2MeetingsMeetingId"
                        ]
                    }
                }
            },
            {
                displayName: "Data",
                name: "data",
                type: "collection",
                default: {
                    linked_records: []
                },
                placeholder: "Add Field",
                options: [
                    {
                        displayName: "Linked Records",
                        name: "linked_records",
                        type: "json",
                        default: []
                    }
                ],
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "meetings"
                        ],
                        operation: [
                            "patchV2MeetingsMeetingId"
                        ]
                    }
                }
            },
            {
                displayName: "Data",
                name: "data",
                type: "collection",
                default: {
                    description: "",
                    end: {
                        schemaAlternative: "alternative1",
                        value: ""
                    },
                    is_all_day: false,
                    participants: [],
                    start: {
                        schemaAlternative: "alternative1",
                        value: ""
                    },
                    title: ""
                },
                placeholder: "Add Field",
                options: [
                    {
                        displayName: "Description",
                        name: "description",
                        type: "string",
                        default: "",
                        description: "The description of the meeting",
                        placeholder: "e.g. Getting you up to speed with the platform and answering any questions you have."
                    },
                    {
                        displayName: "End",
                        name: "end",
                        type: "json",
                        default: {
                            schemaAlternative: "alternative1",
                            value: ""
                        },
                        description: "When the meeting ends. use a datetime and optional timezone for non-all day meetings, or a date for all day meetings."
                    },
                    {
                        displayName: "Is All Day",
                        name: "is_all_day",
                        type: "boolean",
                        default: false,
                        description: "Whether or not the meeting is an all day event. all day events may span multiple days. when true, start and end must use date format. when false, start and end must use datetime with timezone format.",
                        placeholder: "e.g. false"
                    },
                    {
                        displayName: "Linked Records",
                        name: "linked_records",
                        type: "json",
                        default: [],
                        description: "A list of records to link to the meeting. each record is specified by its object (slug or UUID) and record ID (UUID). attio will automatically link the meeting participants' companies to the meeting; this behavior is asynchronous."
                    },
                    {
                        displayName: "Participants",
                        name: "participants",
                        type: "json",
                        default: []
                    },
                    {
                        displayName: "Start",
                        name: "start",
                        type: "json",
                        default: {
                            schemaAlternative: "alternative1",
                            value: ""
                        },
                        description: "When the meeting starts. use a datetime and optional timezone for non-all day meetings, or a date for all day meetings."
                    },
                    {
                        displayName: "Title",
                        name: "title",
                        type: "string",
                        default: "",
                        description: "The title of the meeting",
                        placeholder: "e.g. Onboarding Session"
                    }
                ],
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "meetings"
                        ],
                        operation: [
                            "postV2Meetings"
                        ]
                    }
                }
            },
            {
                displayName: "Meeting ID",
                name: "meeting_id",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. cb59ab17-ad15-460c-a126-0715617c0853",
                hint: "Expected format: uuid",
                displayOptions: {
                    show: {
                        resource: [
                            "meetings"
                        ],
                        operation: [
                            "putV2MeetingsMeetingId"
                        ]
                    }
                }
            },
            {
                displayName: "Data",
                name: "data",
                type: "collection",
                default: {
                    linked_records: []
                },
                placeholder: "Add Field",
                options: [
                    {
                        displayName: "Linked Records",
                        name: "linked_records",
                        type: "json",
                        default: []
                    }
                ],
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "meetings"
                        ],
                        operation: [
                            "putV2MeetingsMeetingId"
                        ]
                    }
                }
            },
            {
                displayName: "Operation",
                name: "operation",
                type: "options",
                noDataExpression: true,
                displayOptions: {
                    show: {
                        resource: [
                            "meta"
                        ]
                    }
                },
                default: "getV2Self",
                options: [
                    {
                        name: "Identify",
                        value: "getV2Self",
                        action: "Identify meta",
                        description: "Inspect an attio access token to identify its workspace, client, audience, and granted permissions. meta."
                    }
                ]
            },
            {
                displayName: "Operation",
                name: "operation",
                type: "options",
                noDataExpression: true,
                displayOptions: {
                    show: {
                        resource: [
                            "notes"
                        ]
                    }
                },
                default: "deleteV2NotesNoteId",
                options: [
                    {
                        name: "Create A",
                        value: "postV2Notes",
                        action: "Create note",
                        description: "Creates a new note for a given record. required scopes: `note:read-write`, `object_configuration:read`, `record_permission:read`. supported token levels: `workspace`, `user`."
                    },
                    {
                        name: "Delete A",
                        value: "deleteV2NotesNoteId",
                        action: "Delete note",
                        description: "Delete a single note by ID. required scopes: `note:read-write`. supported token levels: `workspace`, `user`."
                    },
                    {
                        name: "Get A",
                        value: "getV2NotesNoteId",
                        action: "Get note",
                        description: "Get a single note by ID. required scopes: `note:read`, `object_configuration:read`, `record_permission:read`. supported token levels: `workspace`, `user`."
                    },
                    {
                        name: "List",
                        value: "getV2Notes",
                        action: "List notes",
                        description: "List notes for all records or for a specific record. this endpoint is temporarily rate limited to 10 requests per second. required scopes: `note:read`, `object_configuration:read`, `record_permission:read`. supported token levels: `workspace`, `user`."
                    },
                    {
                        name: "Update A",
                        value: "patchV2NotesNoteId",
                        action: "Update note",
                        description: "Update a note's title or content. only supplied fields change; content replaces the full note body, and the parent record cannot be changed."
                    }
                ]
            },
            {
                displayName: "Note ID",
                name: "note_id",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. ff3f3bd4-40f4-4f80-8187-cd02385af424",
                hint: "Expected format: uuid",
                displayOptions: {
                    show: {
                        resource: [
                            "notes"
                        ],
                        operation: [
                            "deleteV2NotesNoteId"
                        ]
                    }
                }
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "notes"
                        ],
                        operation: [
                            "getV2Notes"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Limit",
                        name: "limit",
                        type: "number",
                        default: 50,
                        description: "Max number of results to return",
                        placeholder: "e.g. 10",
                        typeOptions: {
                            minValue: 1
                        }
                    },
                    {
                        displayName: "Offset",
                        name: "offset",
                        type: "number",
                        default: 0,
                        placeholder: "e.g. 5"
                    },
                    {
                        displayName: "Parent Object",
                        name: "parent_object",
                        type: "string",
                        default: "",
                        placeholder: "e.g. people"
                    },
                    {
                        displayName: "Parent Record ID",
                        name: "parent_record_id",
                        type: "string",
                        default: "",
                        placeholder: "e.g. 891dcbfc-9141-415d-9b2a-2238a6cc012d",
                        hint: "Expected format: uuid"
                    }
                ]
            },
            {
                displayName: "Note ID",
                name: "note_id",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. ff3f3bd4-40f4-4f80-8187-cd02385af424",
                hint: "Expected format: uuid",
                displayOptions: {
                    show: {
                        resource: [
                            "notes"
                        ],
                        operation: [
                            "getV2NotesNoteId"
                        ]
                    }
                }
            },
            {
                displayName: "Note ID",
                name: "note_id",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. ff3f3bd4-40f4-4f80-8187-cd02385af424",
                hint: "Expected format: uuid",
                displayOptions: {
                    show: {
                        resource: [
                            "notes"
                        ],
                        operation: [
                            "patchV2NotesNoteId"
                        ]
                    }
                }
            },
            {
                displayName: "Data",
                name: "data",
                type: "collection",
                default: {},
                placeholder: "Add Field",
                options: [
                    {
                        displayName: "Content",
                        name: "content",
                        type: "string",
                        default: "",
                        description: "The main content of the note, formatted according to the value provided in the `format` field. use `\\n` for line breaks in `plaintext`. for `markdown`, utilize the supported syntax elements to structure and style your note.",
                        placeholder: "e.g. # Meeting Recap: Q4 Planning\n\n**Date:** 2023-10-26\n**Attendees:** Alex, Jamie, Casey\n\n## Key Discussion Points\n\n- Reviewed Q3 performance metrics.\n- Brainstormed key initiatives for Q4.\n- Discussed budget allocation for ==Project Phoenix==.\n\n## Action Items\n\n1. Alex to finalize Q4 roadmap by EOD Friday.\n2. Jamie to schedule follow-up with [Marketing Team](https://app.attio.com/teams/marketing).\n3. Casey to draft initial budget for ~~Project Chimera~~ (now deferred).\n\n*Next steps: Review draft roadmap next week.*"
                    },
                    {
                        displayName: "Format",
                        name: "format",
                        type: "options",
                        default: "plaintext",
                        description: "Choose plaintext or markdown for note content. markdown supports headings (levels 1\u20133), lists, bold, italic, strikethrough, highlights, and links.",
                        placeholder: "e.g. markdown",
                        options: [
                            {
                                name: "Markdown",
                                value: "markdown"
                            },
                            {
                                name: "Plaintext",
                                value: "plaintext"
                            }
                        ]
                    },
                    {
                        displayName: "Title",
                        name: "title",
                        type: "string",
                        default: "",
                        description: "The note title. the title is plaintext only and has no formatting.",
                        placeholder: "e.g. Initial Prospecting Call Summary"
                    }
                ],
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "notes"
                        ],
                        operation: [
                            "patchV2NotesNoteId"
                        ]
                    }
                }
            },
            {
                displayName: "Data",
                name: "data",
                type: "collection",
                default: {
                    content: "",
                    format: "plaintext",
                    parent_object: "",
                    parent_record_id: "",
                    title: ""
                },
                placeholder: "Add Field",
                options: [
                    {
                        displayName: "Content",
                        name: "content",
                        type: "string",
                        default: "",
                        description: "The main content of the note, formatted according to the value provided in the `format` field. use `\\n` for line breaks in `plaintext`. for `markdown`, utilize the supported syntax elements to structure and style your note.",
                        placeholder: "e.g. # Meeting Recap: Q4 Planning\n\n**Date:** 2023-10-26\n**Attendees:** Alex, Jamie, Casey\n\n## Key Discussion Points\n\n- Reviewed Q3 performance metrics.\n- Brainstormed key initiatives for Q4.\n- Discussed budget allocation for ==Project Phoenix==.\n\n## Action Items\n\n1. Alex to finalize Q4 roadmap by EOD Friday.\n2. Jamie to schedule follow-up with [Marketing Team](https://app.attio.com/teams/marketing).\n3. Casey to draft initial budget for ~~Project Chimera~~ (now deferred).\n\n*Next steps: Review draft roadmap next week.*"
                    },
                    {
                        displayName: "Created At",
                        name: "created_at",
                        type: "string",
                        default: "",
                        description: "`Created_at` will default to the current time. however, if you wish to backdate a note for migration or other purposes, you can override with a custom `created_at` value. note that dates before 1970 or in the future are not allowed.",
                        placeholder: "e.g. 2023-01-01T15:00:00.000000000Z"
                    },
                    {
                        displayName: "Format",
                        name: "format",
                        type: "options",
                        default: "plaintext",
                        description: "Choose plaintext or markdown for note content. markdown supports headings (levels 1\u20133), lists, bold, italic, strikethrough, highlights, and links.",
                        placeholder: "e.g. markdown",
                        options: [
                            {
                                name: "Markdown",
                                value: "markdown"
                            },
                            {
                                name: "Plaintext",
                                value: "plaintext"
                            }
                        ]
                    },
                    {
                        displayName: "Meeting ID",
                        name: "meeting_id",
                        type: "string",
                        default: "",
                        description: "An optional ID to associate this note with a meeting. if provided, the meeting must exist. use `null` to explicitly set no meeting association.",
                        placeholder: "e.g. 14beef7a-99f7-4534-a87e-70b564330a4c",
                        hint: "Expected format: uuid"
                    },
                    {
                        displayName: "Parent Object",
                        name: "parent_object",
                        type: "string",
                        default: "",
                        description: "The ID or slug of the parent object the note belongs to",
                        placeholder: "e.g. people"
                    },
                    {
                        displayName: "Parent Record ID",
                        name: "parent_record_id",
                        type: "string",
                        default: "",
                        description: "The ID of the parent record the note belongs to",
                        placeholder: "e.g. 891dcbfc-9141-415d-9b2a-2238a6cc012d",
                        hint: "Expected format: uuid"
                    },
                    {
                        displayName: "Title",
                        name: "title",
                        type: "string",
                        default: "",
                        description: "The note title. the title is plaintext only and has no formatting.",
                        placeholder: "e.g. Initial Prospecting Call Summary"
                    }
                ],
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "notes"
                        ],
                        operation: [
                            "postV2Notes"
                        ]
                    }
                }
            },
            {
                displayName: "Operation",
                name: "operation",
                type: "options",
                noDataExpression: true,
                displayOptions: {
                    show: {
                        resource: [
                            "objects"
                        ]
                    }
                },
                default: "deleteV2ObjectsObject",
                options: [
                    {
                        name: "Create An",
                        value: "postV2Objects",
                        action: "Create object",
                        description: "Creates a new custom object in your workspace. required scopes: `object_configuration:read-write`. supported token levels: `workspace`, `user`."
                    },
                    {
                        name: "Delete An",
                        value: "deleteV2ObjectsObject",
                        action: "Delete object",
                        description: "Delete a custom object by ID or slug, along with its records. system objects such as people and companies cannot be deleted."
                    },
                    {
                        name: "Get An",
                        value: "getV2ObjectsObject",
                        action: "Get object",
                        description: "Gets a single object by its `object_id` or slug. required scopes: `object_configuration:read`. supported token levels: `workspace`, `user`."
                    },
                    {
                        name: "List",
                        value: "getV2Objects",
                        action: "List objects",
                        description: "Lists all system-defined and user-defined objects in your workspace. required scopes: `object_configuration:read`. supported token levels: `workspace`, `user`."
                    },
                    {
                        name: "List Views For",
                        value: "getV2ObjectsObjectViews",
                        action: "List views for object",
                        description: "Lists saved views for an object. results are ordered by view ID (`ID.view_id` ascending). required scopes: `object_configuration:read`. supported token levels: `workspace`, `user`."
                    },
                    {
                        name: "Update An",
                        value: "patchV2ObjectsObject",
                        action: "Update object",
                        description: "Updates a single object. the object to be updated is identified by its `object_id`. required scopes: `object_configuration:read-write`. supported token levels: `workspace`, `user`."
                    }
                ]
            },
            {
                displayName: "Object",
                name: "object",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. people",
                displayOptions: {
                    show: {
                        resource: [
                            "objects"
                        ],
                        operation: [
                            "deleteV2ObjectsObject"
                        ]
                    }
                }
            },
            {
                displayName: "Object",
                name: "object",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. people",
                displayOptions: {
                    show: {
                        resource: [
                            "objects"
                        ],
                        operation: [
                            "getV2ObjectsObject"
                        ]
                    }
                }
            },
            {
                displayName: "Object",
                name: "object",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. people",
                displayOptions: {
                    show: {
                        resource: [
                            "objects"
                        ],
                        operation: [
                            "getV2ObjectsObjectViews"
                        ]
                    }
                }
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "objects"
                        ],
                        operation: [
                            "getV2ObjectsObjectViews"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Cursor",
                        name: "cursor",
                        type: "string",
                        default: "",
                        placeholder: "e.g. eyJkZXNjcmlwdGlvbiI6ICJ0aGlzIGlzIGEgY3Vyc29yIn0=.eM56CGbqZ6G1NHiJchTIkH4vKDr"
                    },
                    {
                        displayName: "Limit",
                        name: "limit",
                        type: "number",
                        default: 50,
                        description: "Max number of results to return",
                        placeholder: "e.g. 500",
                        typeOptions: {
                            minValue: 1
                        }
                    },
                    {
                        displayName: "Show Archived",
                        name: "show_archived",
                        type: "boolean",
                        default: false,
                        description: "Whether to enable show archived",
                        placeholder: "e.g. false"
                    }
                ]
            },
            {
                displayName: "Object",
                name: "object",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. people",
                displayOptions: {
                    show: {
                        resource: [
                            "objects"
                        ],
                        operation: [
                            "patchV2ObjectsObject"
                        ]
                    }
                }
            },
            {
                displayName: "Data",
                name: "data",
                type: "collection",
                default: {},
                placeholder: "Add Field",
                options: [
                    {
                        displayName: "API Slug",
                        name: "api_slug",
                        type: "string",
                        default: "",
                        description: "A unique, human-readable slug to access the object through URLs and API calls. should be formatted in snake case.",
                        placeholder: "e.g. people"
                    },
                    {
                        displayName: "Plural Noun",
                        name: "plural_noun",
                        type: "string",
                        default: "",
                        description: "The plural form of the object's name",
                        placeholder: "e.g. People"
                    },
                    {
                        displayName: "Singular Noun",
                        name: "singular_noun",
                        type: "string",
                        default: "",
                        description: "The singular form of the object's name",
                        placeholder: "e.g. Person"
                    }
                ],
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "objects"
                        ],
                        operation: [
                            "patchV2ObjectsObject"
                        ]
                    }
                }
            },
            {
                displayName: "Data",
                name: "data",
                type: "collection",
                default: {
                    api_slug: "",
                    plural_noun: "",
                    singular_noun: ""
                },
                placeholder: "Add Field",
                options: [
                    {
                        displayName: "API Slug",
                        name: "api_slug",
                        type: "string",
                        default: "",
                        description: "A unique, human-readable slug to access the object through URLs and API calls. should be formatted in snake case.",
                        placeholder: "e.g. people"
                    },
                    {
                        displayName: "Plural Noun",
                        name: "plural_noun",
                        type: "string",
                        default: "",
                        description: "The plural form of the object's name",
                        placeholder: "e.g. People"
                    },
                    {
                        displayName: "Singular Noun",
                        name: "singular_noun",
                        type: "string",
                        default: "",
                        description: "The singular form of the object's name",
                        placeholder: "e.g. Person"
                    }
                ],
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "objects"
                        ],
                        operation: [
                            "postV2Objects"
                        ]
                    }
                }
            },
            {
                displayName: "Operation",
                name: "operation",
                type: "options",
                noDataExpression: true,
                displayOptions: {
                    show: {
                        resource: [
                            "records"
                        ]
                    }
                },
                default: "deleteV2ObjectsObjectRecordsRecordId",
                options: [
                    {
                        name: "Create A",
                        value: "postV2ObjectsObjectRecords",
                        action: "Create record",
                        description: "Create a person, company, or other record. unique-attribute conflicts return an error; use the upsert endpoint to update a matching record."
                    },
                    {
                        name: "Delete A",
                        value: "deleteV2ObjectsObjectRecordsRecordId",
                        action: "Delete record",
                        description: "Deletes a single record (e.g. a company or person) by ID. required scopes: `object_configuration:read`, `record_permission:read-write`. supported token levels: `workspace`, `user`."
                    },
                    {
                        name: "Get A",
                        value: "getV2ObjectsObjectRecordsRecordId",
                        action: "Get record",
                        description: "Gets a single person, company or other record by its `record_id`. required scopes: `record_permission:read`, `object_configuration:read`. supported token levels: `workspace`, `user`."
                    },
                    {
                        name: "List",
                        value: "postV2ObjectsObjectRecordsQuery",
                        action: "List records",
                        description: "Lists people, company or other records, with the option to filter and sort results. required scopes: `record_permission:read`, `object_configuration:read`. supported token levels: `workspace`, `user`."
                    },
                    {
                        name: "List Record Attribute Values",
                        value: "getV2ObjectsObjectRecordsRecordIdAttributesAttributeValues",
                        action: "List record attribute values",
                        description: "Get an attribute's values for a record. set show_historic to include historical values; this is unsupported for comint and enriched attributes. values can be unavailable when the workspace lacks a required billing feature."
                    },
                    {
                        name: "List Record Entries",
                        value: "getV2ObjectsObjectRecordsRecordIdEntries",
                        action: "List record entries",
                        description: "List entries across all lists for a parent record. the response includes entry, list, and creation metadata but not entry values; retrieve each entry separately for its values."
                    },
                    {
                        name: "Merge Two",
                        value: "postV2ObjectsObjectRecordsMerge",
                        action: "Merge two records",
                        description: "Merge two records of the same object. the primary record wins conflicts; both inputs are marked merged and replaced by a new record. a 202 response means processing is asynchronous; 200 means the result is ready."
                    },
                    {
                        name: "Search",
                        value: "postV2ObjectsRecordsSearch",
                        action: "Search records",
                        description: "Fuzzy-search records across objects by names, domains, emails, phone numbers, social handles, and labels. results may be eventually consistent; use the record query endpoint for current results."
                    },
                    {
                        name: "Update A Record (Append Multiselect Values)",
                        value: "patchV2ObjectsObjectRecordsRecordId",
                        action: "Update record append multiselect values",
                        description: "Update a record by record_id and prepend supplied multi-select values. use put to replace existing values."
                    },
                    {
                        name: "Update A Record (Overwrite Multiselect Values)",
                        value: "putV2ObjectsObjectRecordsRecordId",
                        action: "Update record overwrite multiselect values",
                        description: "Update a record by record_id. supplied multi-select values replace existing values; use patch to add values without removing existing ones."
                    },
                    {
                        name: "Upsert A",
                        value: "putV2ObjectsObjectRecords",
                        action: "Upsert record",
                        description: "Create or update a record by matching the specified attribute. a match is updated; otherwise, a record is created. use the create endpoint to avoid matching."
                    },
                    {
                        name: "Write Record Attribute Values",
                        value: "putV2ObjectsObjectRecordsRecordIdAttributesAttributeValues",
                        action: "Write record attribute values",
                        description: "Replace a record attribute's full value history. existing values are removed; provide at least one timestamped value. single-value intervals cannot overlap, and only one may have no end time."
                    }
                ]
            },
            {
                displayName: "Object",
                name: "object",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. people",
                displayOptions: {
                    show: {
                        resource: [
                            "records"
                        ],
                        operation: [
                            "deleteV2ObjectsObjectRecordsRecordId"
                        ]
                    }
                }
            },
            {
                displayName: "Record ID",
                name: "record_id",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. 891dcbfc-9141-415d-9b2a-2238a6cc012d",
                hint: "Expected format: uuid",
                displayOptions: {
                    show: {
                        resource: [
                            "records"
                        ],
                        operation: [
                            "deleteV2ObjectsObjectRecordsRecordId"
                        ]
                    }
                }
            },
            {
                displayName: "Object",
                name: "object",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. people",
                displayOptions: {
                    show: {
                        resource: [
                            "records"
                        ],
                        operation: [
                            "getV2ObjectsObjectRecordsRecordId"
                        ]
                    }
                }
            },
            {
                displayName: "Record ID",
                name: "record_id",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. 891dcbfc-9141-415d-9b2a-2238a6cc012d",
                hint: "Expected format: uuid",
                displayOptions: {
                    show: {
                        resource: [
                            "records"
                        ],
                        operation: [
                            "getV2ObjectsObjectRecordsRecordId"
                        ]
                    }
                }
            },
            {
                displayName: "Object",
                name: "object",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. people",
                displayOptions: {
                    show: {
                        resource: [
                            "records"
                        ],
                        operation: [
                            "getV2ObjectsObjectRecordsRecordIdAttributesAttributeValues"
                        ]
                    }
                }
            },
            {
                displayName: "Record ID",
                name: "record_id",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. 891dcbfc-9141-415d-9b2a-2238a6cc012d",
                hint: "Expected format: uuid",
                displayOptions: {
                    show: {
                        resource: [
                            "records"
                        ],
                        operation: [
                            "getV2ObjectsObjectRecordsRecordIdAttributesAttributeValues"
                        ]
                    }
                }
            },
            {
                displayName: "Attribute",
                name: "attribute",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. 41252299-f8c7-4b5e-99c9-4ff8321d2f96",
                displayOptions: {
                    show: {
                        resource: [
                            "records"
                        ],
                        operation: [
                            "getV2ObjectsObjectRecordsRecordIdAttributesAttributeValues"
                        ]
                    }
                }
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "records"
                        ],
                        operation: [
                            "getV2ObjectsObjectRecordsRecordIdAttributesAttributeValues"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Limit",
                        name: "limit",
                        type: "number",
                        default: 50,
                        description: "Max number of results to return",
                        placeholder: "e.g. 10",
                        typeOptions: {
                            minValue: 1
                        }
                    },
                    {
                        displayName: "Offset",
                        name: "offset",
                        type: "number",
                        default: 0,
                        placeholder: "e.g. 5"
                    },
                    {
                        displayName: "Show Historic",
                        name: "show_historic",
                        type: "boolean",
                        default: false,
                        description: "Whether to enable show historic",
                        placeholder: "e.g. true"
                    }
                ]
            },
            {
                displayName: "Object",
                name: "object",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. people",
                displayOptions: {
                    show: {
                        resource: [
                            "records"
                        ],
                        operation: [
                            "getV2ObjectsObjectRecordsRecordIdEntries"
                        ]
                    }
                }
            },
            {
                displayName: "Record ID",
                name: "record_id",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. 891dcbfc-9141-415d-9b2a-2238a6cc012d",
                hint: "Expected format: uuid",
                displayOptions: {
                    show: {
                        resource: [
                            "records"
                        ],
                        operation: [
                            "getV2ObjectsObjectRecordsRecordIdEntries"
                        ]
                    }
                }
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "records"
                        ],
                        operation: [
                            "getV2ObjectsObjectRecordsRecordIdEntries"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Limit",
                        name: "limit",
                        type: "number",
                        default: 50,
                        description: "Max number of results to return",
                        placeholder: "e.g. 10",
                        typeOptions: {
                            minValue: 1
                        }
                    },
                    {
                        displayName: "Offset",
                        name: "offset",
                        type: "number",
                        default: 0,
                        placeholder: "e.g. 5"
                    }
                ]
            },
            {
                displayName: "Object",
                name: "object",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. people",
                displayOptions: {
                    show: {
                        resource: [
                            "records"
                        ],
                        operation: [
                            "patchV2ObjectsObjectRecordsRecordId"
                        ]
                    }
                }
            },
            {
                displayName: "Record ID",
                name: "record_id",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. 891dcbfc-9141-415d-9b2a-2238a6cc012d",
                displayOptions: {
                    show: {
                        resource: [
                            "records"
                        ],
                        operation: [
                            "patchV2ObjectsObjectRecordsRecordId"
                        ]
                    }
                }
            },
            {
                displayName: "Data",
                name: "data",
                type: "collection",
                default: {
                    values: {}
                },
                placeholder: "Add Field",
                options: [
                    {
                        displayName: "Values",
                        name: "values",
                        type: "json",
                        default: {},
                        description: "Attribute values keyed by api_slug or attribute_id. pass one value for single-select attributes or an array for multi-select values; see attio's attribute type documentation for value formats.",
                        placeholder: "e.g. [object Object]"
                    }
                ],
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "records"
                        ],
                        operation: [
                            "patchV2ObjectsObjectRecordsRecordId"
                        ]
                    }
                }
            },
            {
                displayName: "Object",
                name: "object",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. people",
                displayOptions: {
                    show: {
                        resource: [
                            "records"
                        ],
                        operation: [
                            "postV2ObjectsObjectRecords"
                        ]
                    }
                }
            },
            {
                displayName: "Data",
                name: "data",
                type: "collection",
                default: {
                    values: {}
                },
                placeholder: "Add Field",
                options: [
                    {
                        displayName: "Values",
                        name: "values",
                        type: "json",
                        default: {},
                        description: "Attribute values keyed by api_slug or attribute_id. pass one value for single-select attributes or an array for multi-select values; see attio's attribute type documentation for value formats.",
                        placeholder: "e.g. [object Object]"
                    }
                ],
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "records"
                        ],
                        operation: [
                            "postV2ObjectsObjectRecords"
                        ]
                    }
                }
            },
            {
                displayName: "Object",
                name: "object",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. people",
                displayOptions: {
                    show: {
                        resource: [
                            "records"
                        ],
                        operation: [
                            "postV2ObjectsObjectRecordsMerge"
                        ]
                    }
                }
            },
            {
                displayName: "Data",
                name: "data",
                type: "collection",
                default: {
                    primary_record_id: "",
                    secondary_record_id: ""
                },
                placeholder: "Add Field",
                options: [
                    {
                        displayName: "Primary Record ID",
                        name: "primary_record_id",
                        type: "string",
                        default: "",
                        description: "The ID of the record to keep values from. where both records have a value for the same attribute, the primary record's value takes precedence.",
                        placeholder: "e.g. 891dcbfc-9141-415d-9b2a-2238a6cc012d",
                        hint: "Expected format: uuid"
                    },
                    {
                        displayName: "Secondary Record ID",
                        name: "secondary_record_id",
                        type: "string",
                        default: "",
                        description: "The ID of the record to merge into the primary record. its values are only kept where the primary record has no value for that attribute.",
                        placeholder: "e.g. bf071e1f-6035-429d-b874-d83ea64ea13b",
                        hint: "Expected format: uuid"
                    }
                ],
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "records"
                        ],
                        operation: [
                            "postV2ObjectsObjectRecordsMerge"
                        ]
                    }
                }
            },
            {
                displayName: "Object",
                name: "object",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. people",
                displayOptions: {
                    show: {
                        resource: [
                            "records"
                        ],
                        operation: [
                            "postV2ObjectsObjectRecordsQuery"
                        ]
                    }
                }
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "records"
                        ],
                        operation: [
                            "postV2ObjectsObjectRecordsQuery"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Filter",
                        name: "filter",
                        type: "json",
                        default: {},
                        description: "An object used to filter results to a subset of results. cannot be used together with `filter_view_id`. see the full guide to filtering and sorting here.",
                        placeholder: "e.g. [object Object]"
                    },
                    {
                        displayName: "Filter View ID",
                        name: "filter_view_id",
                        type: "string",
                        default: "",
                        description: "UUID of a saved view to apply. it cannot be combined with filter; sorting, limits, and offsets remain independent, and all attributes are returned.",
                        hint: "Expected format: uuid"
                    },
                    {
                        displayName: "Limit",
                        name: "limit",
                        type: "number",
                        default: 50,
                        description: "Max number of results to return",
                        placeholder: "e.g. 500",
                        typeOptions: {
                            minValue: 1
                        }
                    },
                    {
                        displayName: "Offset",
                        name: "offset",
                        type: "number",
                        default: 0,
                        description: "The number of results to skip over before returning. defaults to 0. see the full guide to pagination here.",
                        placeholder: "e.g. 0"
                    },
                    {
                        displayName: "Sorts",
                        name: "sorts",
                        type: "json",
                        default: [],
                        description: "An object used to sort results. see the full guide to filtering and sorting here.",
                        placeholder: "e.g. [object Object]"
                    }
                ]
            },
            {
                displayName: "Objects",
                name: "objects",
                type: "json",
                default: [],
                required: true,
                description: "Specifies which objects to filter results by. at least one object must be specified. accepts object slugs or IDs.",
                placeholder: "e.g. people,deals,1b31b79a-ddf9-4d57-a320-884061b2bcff",
                displayOptions: {
                    show: {
                        resource: [
                            "records"
                        ],
                        operation: [
                            "postV2ObjectsRecordsSearch"
                        ]
                    }
                }
            },
            {
                displayName: "Query",
                name: "query",
                type: "string",
                default: "",
                required: true,
                description: "Query string to search for. an empty string returns a default set of results.",
                placeholder: "e.g. alan mathis",
                displayOptions: {
                    show: {
                        resource: [
                            "records"
                        ],
                        operation: [
                            "postV2ObjectsRecordsSearch"
                        ]
                    }
                }
            },
            {
                displayName: "Request As",
                name: "request_as",
                type: "json",
                default: {
                    schemaAlternative: "alternative1",
                    value: ""
                },
                required: true,
                description: "Specifies the context in which to perform the search. use 'workspace' to return all search results or specify a workspace member to limit results to what one specific person in your workspace can see.",
                displayOptions: {
                    show: {
                        resource: [
                            "records"
                        ],
                        operation: [
                            "postV2ObjectsRecordsSearch"
                        ]
                    }
                }
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "records"
                        ],
                        operation: [
                            "postV2ObjectsRecordsSearch"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Limit",
                        name: "limit",
                        type: "number",
                        default: 50,
                        description: "Max number of results to return",
                        placeholder: "e.g. 25",
                        typeOptions: {
                            minValue: 1
                        }
                    }
                ]
            },
            {
                displayName: "Object",
                name: "object",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. people",
                displayOptions: {
                    show: {
                        resource: [
                            "records"
                        ],
                        operation: [
                            "putV2ObjectsObjectRecords"
                        ]
                    }
                }
            },
            {
                displayName: "Matching Attribute",
                name: "matching_attribute",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. 41252299-f8c7-4b5e-99c9-4ff8321d2f96",
                displayOptions: {
                    show: {
                        resource: [
                            "records"
                        ],
                        operation: [
                            "putV2ObjectsObjectRecords"
                        ]
                    }
                }
            },
            {
                displayName: "Data",
                name: "data",
                type: "collection",
                default: {
                    values: {}
                },
                placeholder: "Add Field",
                options: [
                    {
                        displayName: "Values",
                        name: "values",
                        type: "json",
                        default: {},
                        description: "Attribute values keyed by api_slug or attribute_id. pass one value for single-select attributes or an array for multi-select values; see attio's attribute type documentation for value formats.",
                        placeholder: "e.g. [object Object]"
                    }
                ],
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "records"
                        ],
                        operation: [
                            "putV2ObjectsObjectRecords"
                        ]
                    }
                }
            },
            {
                displayName: "Object",
                name: "object",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. people",
                displayOptions: {
                    show: {
                        resource: [
                            "records"
                        ],
                        operation: [
                            "putV2ObjectsObjectRecordsRecordId"
                        ]
                    }
                }
            },
            {
                displayName: "Record ID",
                name: "record_id",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. 891dcbfc-9141-415d-9b2a-2238a6cc012d",
                displayOptions: {
                    show: {
                        resource: [
                            "records"
                        ],
                        operation: [
                            "putV2ObjectsObjectRecordsRecordId"
                        ]
                    }
                }
            },
            {
                displayName: "Data",
                name: "data",
                type: "collection",
                default: {
                    values: {}
                },
                placeholder: "Add Field",
                options: [
                    {
                        displayName: "Values",
                        name: "values",
                        type: "json",
                        default: {},
                        description: "Attribute values keyed by api_slug or attribute_id. pass one value for single-select attributes or an array for multi-select values; see attio's attribute type documentation for value formats.",
                        placeholder: "e.g. [object Object]"
                    }
                ],
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "records"
                        ],
                        operation: [
                            "putV2ObjectsObjectRecordsRecordId"
                        ]
                    }
                }
            },
            {
                displayName: "Object",
                name: "object",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. people",
                displayOptions: {
                    show: {
                        resource: [
                            "records"
                        ],
                        operation: [
                            "putV2ObjectsObjectRecordsRecordIdAttributesAttributeValues"
                        ]
                    }
                }
            },
            {
                displayName: "Record ID",
                name: "record_id",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. 891dcbfc-9141-415d-9b2a-2238a6cc012d",
                hint: "Expected format: uuid",
                displayOptions: {
                    show: {
                        resource: [
                            "records"
                        ],
                        operation: [
                            "putV2ObjectsObjectRecordsRecordIdAttributesAttributeValues"
                        ]
                    }
                }
            },
            {
                displayName: "Attribute",
                name: "attribute",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. 41252299-f8c7-4b5e-99c9-4ff8321d2f96",
                displayOptions: {
                    show: {
                        resource: [
                            "records"
                        ],
                        operation: [
                            "putV2ObjectsObjectRecordsRecordIdAttributesAttributeValues"
                        ]
                    }
                }
            },
            {
                displayName: "Data",
                name: "data",
                type: "collection",
                default: {
                    replace_history: true,
                    values: []
                },
                placeholder: "Add Field",
                options: [
                    {
                        displayName: "Replace History",
                        name: "replace_history",
                        type: "options",
                        default: true,
                        description: "Must be `true`. acknowledges that this request replaces the attribute's entire value history, destroying every value it currently has, including values not present in this request.",
                        options: [
                            {
                                name: "True",
                                value: true
                            }
                        ]
                    },
                    {
                        displayName: "Values",
                        name: "values",
                        type: "json",
                        default: [],
                        description: "The complete value history to write, replacing any existing values. values may be supplied in any order. gaps between intervals are allowed. at least one value is required, and a maximum of 400 values may be written in one request."
                    }
                ],
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "records"
                        ],
                        operation: [
                            "putV2ObjectsObjectRecordsRecordIdAttributesAttributeValues"
                        ]
                    }
                }
            },
            {
                displayName: "Operation",
                name: "operation",
                type: "options",
                noDataExpression: true,
                displayOptions: {
                    show: {
                        resource: [
                            "sequences"
                        ]
                    }
                },
                default: "postV2SequencesUnsubscribedEmails",
                options: [
                    {
                        name: "Add Emails To The Unsubscribe List",
                        value: "postV2SequencesUnsubscribedEmails",
                        action: "Add emails to the unsubscribe list sequences",
                        description: "Add emails to the workspace's sequence unsubscribe list. these addresses cannot be enrolled, and active sequence runs are exited. existing entries are ignored, so the request is safe to retry."
                    }
                ]
            },
            {
                displayName: "Data",
                name: "data",
                type: "collection",
                default: {
                    email_addresses: []
                },
                placeholder: "Add Field",
                options: [
                    {
                        displayName: "Email Addresses",
                        name: "email_addresses",
                        type: "json",
                        default: [],
                        description: "The email addresses to add to the unsubscribe list. a maximum of 1000 email addresses can be provided per request. email addresses are normalized before they are stored."
                    }
                ],
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "sequences"
                        ],
                        operation: [
                            "postV2SequencesUnsubscribedEmails"
                        ]
                    }
                }
            },
            {
                displayName: "Operation",
                name: "operation",
                type: "options",
                noDataExpression: true,
                displayOptions: {
                    show: {
                        resource: [
                            "tasks"
                        ]
                    }
                },
                default: "deleteV2TasksTaskId",
                options: [
                    {
                        name: "Create A",
                        value: "postV2Tasks",
                        action: "Create task",
                        description: "Creates a new task. at present, tasks can only be created from plaintext without record reference formatting. required scopes: `task:read-write`, `object_configuration:read`, `record_permission:read`, `user_management:read`. supported token levels: `workspace`, `user`."
                    },
                    {
                        name: "Delete A",
                        value: "deleteV2TasksTaskId",
                        action: "Delete task",
                        description: "Delete a task by ID. required scopes: `task:read-write`. supported token levels: `workspace`, `user`."
                    },
                    {
                        name: "Get A",
                        value: "getV2TasksTaskId",
                        action: "Get task",
                        description: "Get a single task by ID. required scopes: `task:read`, `object_configuration:read`, `record_permission:read`, `user_management:read`. supported token levels: `workspace`, `user`."
                    },
                    {
                        name: "List",
                        value: "getV2Tasks",
                        action: "List tasks",
                        description: "List all tasks. results are sorted by creation date, from oldest to newest. required scopes: `task:read`, `object_configuration:read`, `record_permission:read`, `user_management:read`. supported token levels: `workspace`, `user`."
                    },
                    {
                        name: "Update A",
                        value: "patchV2TasksTaskId",
                        action: "Update task",
                        description: "Update a task by task_id. only deadline_at, is_completed, linked_records, and assignees can be changed."
                    }
                ]
            },
            {
                displayName: "Task ID",
                name: "task_id",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. 649e34f4-c39a-4f4d-99ef-48a36bef8f04",
                hint: "Expected format: uuid",
                displayOptions: {
                    show: {
                        resource: [
                            "tasks"
                        ],
                        operation: [
                            "deleteV2TasksTaskId"
                        ]
                    }
                }
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "tasks"
                        ],
                        operation: [
                            "getV2Tasks"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Assignee",
                        name: "assignee",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Is Completed",
                        name: "is_completed",
                        type: "boolean",
                        default: false,
                        description: "Whether to enable is completed",
                        placeholder: "e.g. true"
                    },
                    {
                        displayName: "Limit",
                        name: "limit",
                        type: "number",
                        default: 50,
                        description: "Max number of results to return",
                        placeholder: "e.g. 10",
                        typeOptions: {
                            minValue: 1
                        }
                    },
                    {
                        displayName: "Linked Object",
                        name: "linked_object",
                        type: "string",
                        default: "",
                        placeholder: "e.g. people"
                    },
                    {
                        displayName: "Linked Record ID",
                        name: "linked_record_id",
                        type: "string",
                        default: "",
                        placeholder: "e.g. 891dcbfc-9141-415d-9b2a-2238a6cc012d",
                        hint: "Expected format: uuid"
                    },
                    {
                        displayName: "Offset",
                        name: "offset",
                        type: "number",
                        default: 0,
                        placeholder: "e.g. 5"
                    },
                    {
                        displayName: "Sort",
                        name: "sort",
                        type: "options",
                        default: "created_at:asc",
                        placeholder: "e.g. created_at:desc",
                        options: [
                            {
                                name: "Completed At:Asc",
                                value: "completed_at:asc"
                            },
                            {
                                name: "Completed At:Desc",
                                value: "completed_at:desc"
                            },
                            {
                                name: "Created At:Asc",
                                value: "created_at:asc"
                            },
                            {
                                name: "Created At:Desc",
                                value: "created_at:desc"
                            }
                        ]
                    }
                ]
            },
            {
                displayName: "Task ID",
                name: "task_id",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. 649e34f4-c39a-4f4d-99ef-48a36bef8f04",
                hint: "Expected format: uuid",
                displayOptions: {
                    show: {
                        resource: [
                            "tasks"
                        ],
                        operation: [
                            "getV2TasksTaskId"
                        ]
                    }
                }
            },
            {
                displayName: "Task ID",
                name: "task_id",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. 649e34f4-c39a-4f4d-99ef-48a36bef8f04",
                hint: "Expected format: uuid",
                displayOptions: {
                    show: {
                        resource: [
                            "tasks"
                        ],
                        operation: [
                            "patchV2TasksTaskId"
                        ]
                    }
                }
            },
            {
                displayName: "Data",
                name: "data",
                type: "collection",
                default: {},
                placeholder: "Add Field",
                options: [
                    {
                        displayName: "Assignees",
                        name: "assignees",
                        type: "json",
                        default: [],
                        description: "Workspace members assigned to this task"
                    },
                    {
                        displayName: "Deadline At",
                        name: "deadline_at",
                        type: "string",
                        default: "",
                        description: "The deadline of the task, in ISO 8601 format",
                        placeholder: "e.g. 2023-01-01T15:00:00.000000000Z"
                    },
                    {
                        displayName: "Is Completed",
                        name: "is_completed",
                        type: "boolean",
                        default: false,
                        description: "Whether the task has been completed",
                        placeholder: "e.g. false"
                    },
                    {
                        displayName: "Linked Records",
                        name: "linked_records",
                        type: "json",
                        default: {
                            schemaAlternative: "alternative1",
                            value: ""
                        },
                        description: "Records linked to the task. records can be linked by domain (for companies), email address (for people), record ID (for all objects) or by a unique matching attribute (for all objects). creating record links within task content text is not possible via the API at present."
                    }
                ],
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "tasks"
                        ],
                        operation: [
                            "patchV2TasksTaskId"
                        ]
                    }
                }
            },
            {
                displayName: "Data",
                name: "data",
                type: "collection",
                default: {
                    assignees: [],
                    content: "",
                    deadline_at: "",
                    format: "plaintext",
                    is_completed: false,
                    linked_records: {
                        schemaAlternative: "alternative1",
                        value: ""
                    }
                },
                placeholder: "Add Field",
                options: [
                    {
                        displayName: "Assignees",
                        name: "assignees",
                        type: "json",
                        default: [],
                        description: "Workspace members assigned to this task"
                    },
                    {
                        displayName: "Content",
                        name: "content",
                        type: "string",
                        default: "",
                        description: "The text content of the task, in the format specified by the `format` property. a max length of 2000 characters is enforced.",
                        placeholder: "e.g. Follow up on current software solutions"
                    },
                    {
                        displayName: "Deadline At",
                        name: "deadline_at",
                        type: "string",
                        default: "",
                        description: "The deadline of the task, in ISO 8601 format",
                        placeholder: "e.g. 2023-01-01T15:00:00.000000000Z"
                    },
                    {
                        displayName: "Format",
                        name: "format",
                        type: "options",
                        default: "plaintext",
                        description: "The format of the task content to be created. rich text formatting, links and @references are not supported.",
                        options: [
                            {
                                name: "Plaintext",
                                value: "plaintext"
                            }
                        ]
                    },
                    {
                        displayName: "Is Completed",
                        name: "is_completed",
                        type: "boolean",
                        default: false,
                        description: "Whether the task has been completed",
                        placeholder: "e.g. false"
                    },
                    {
                        displayName: "Linked Records",
                        name: "linked_records",
                        type: "json",
                        default: {
                            schemaAlternative: "alternative1",
                            value: ""
                        },
                        description: "Records linked to the task. records can be linked by domain (for companies), email address (for people), record ID (for all objects) or by a unique matching attribute (for all objects). creating record links within task content text is not possible via the API at present."
                    }
                ],
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "tasks"
                        ],
                        operation: [
                            "postV2Tasks"
                        ]
                    }
                }
            },
            {
                displayName: "Operation",
                name: "operation",
                type: "options",
                noDataExpression: true,
                displayOptions: {
                    show: {
                        resource: [
                            "threads"
                        ]
                    }
                },
                default: "getV2Threads",
                options: [
                    {
                        name: "Get A Thread And Its Comments",
                        value: "getV2ThreadsThreadId",
                        action: "Get thread and its comments",
                        description: "List a thread's comments oldest first, up to 250 per page. follow next_cursor to continue. created_after filters comments by creation time; the opening comment appears only when it matches."
                    },
                    {
                        name: "List",
                        value: "getV2Threads",
                        action: "List threads",
                        description: "List comment threads on a record or list entry. each thread includes up to 80 oldest replies; use the thread-comments endpoint to retrieve more."
                    }
                ]
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "threads"
                        ],
                        operation: [
                            "getV2Threads"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Entry ID",
                        name: "entry_id",
                        type: "string",
                        default: "",
                        placeholder: "e.g. 2e6e29ea-c4e0-4f44-842d-78a891f8c156",
                        hint: "Expected format: uuid"
                    },
                    {
                        displayName: "Limit",
                        name: "limit",
                        type: "number",
                        default: 50,
                        description: "Max number of results to return",
                        placeholder: "e.g. 10",
                        typeOptions: {
                            minValue: 1
                        }
                    },
                    {
                        displayName: "List",
                        name: "list",
                        type: "string",
                        default: "",
                        placeholder: "e.g. 33ebdbe9-e529-47c9-b894-0ba25e9c15c0"
                    },
                    {
                        displayName: "Object",
                        name: "object",
                        type: "string",
                        default: "",
                        placeholder: "e.g. people"
                    },
                    {
                        displayName: "Offset",
                        name: "offset",
                        type: "number",
                        default: 0,
                        placeholder: "e.g. 5"
                    },
                    {
                        displayName: "Record ID",
                        name: "record_id",
                        type: "string",
                        default: "",
                        placeholder: "e.g. 891dcbfc-9141-415d-9b2a-2238a6cc012d",
                        hint: "Expected format: uuid"
                    }
                ]
            },
            {
                displayName: "Thread ID",
                name: "thread_id",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. a649e4d9-435c-43fb-83ba-847b4876f27a",
                hint: "Expected format: uuid",
                displayOptions: {
                    show: {
                        resource: [
                            "threads"
                        ],
                        operation: [
                            "getV2ThreadsThreadId"
                        ]
                    }
                }
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "threads"
                        ],
                        operation: [
                            "getV2ThreadsThreadId"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Created After",
                        name: "created_after",
                        type: "string",
                        default: "",
                        placeholder: "e.g. 2023-01-01T15:00:00.000000000Z"
                    },
                    {
                        displayName: "Cursor",
                        name: "cursor",
                        type: "string",
                        default: "",
                        placeholder: "e.g. eyJkZXNjcmlwdGlvbiI6ICJ0aGlzIGlzIGEgY3Vyc29yIn0=.eM56CGbqZ6G1NHiJchTIkH4vKDr"
                    },
                    {
                        displayName: "Limit",
                        name: "limit",
                        type: "number",
                        default: 50,
                        description: "Max number of results to return",
                        placeholder: "e.g. 250",
                        typeOptions: {
                            minValue: 1
                        }
                    }
                ]
            }
        ]
    };

  public async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const inputItems = this.getInputData();
    const output: INodeExecutionData[] = [];
    for (let itemIndex = 0; itemIndex < inputItems.length; itemIndex += 1) {
      const outputStart = output.length;
      let errorPlan: Record<string, { title: string; recovery?: string; parameter?: string }> = {};
      try {
        const operation = this.getNodeParameter('operation', itemIndex) as string;
        const nodeVersion = this.getNode().typeVersion;
        let additionalFields: IDataObject = {};
        const nodeOptions = this.getNodeParameter('options', itemIndex, {}) as IDataObject;
        
        let retryContract: RetryContract = { mode: 'none', maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0 };
        let credentialApplications: CredentialApplication[] | undefined;
        let options: IHttpRequestOptions;
        let pagination: PaginationContract = { style: 'none', advancement: '', maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10 * 1024 * 1024, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        let responsePlan: { binary: boolean; full: boolean; envelopePath: string; itemPath: string; fields: string[]; simplified: string[] } = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        switch (operation) {
          case "deleteV2ActivitiesActivity": {
        
        
        let path = "/v2/activities/{activity}";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{activity}").join(encodeURIComponent(String(this.getNodeParameter("activity", itemIndex))));
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "DELETE" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Bad Request"},"403":{"title":"Forbidden"},"404":{"title":"Not Found"}};
        break;
      }
    case "getV2Activities": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/v2/activities";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        if (additionalFields["limit"] !== undefined) qs["limit"] = additionalFields["limit"];
    if (additionalFields["cursor"] !== undefined) qs["cursor"] = additionalFields["cursor"];
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","pagination"], simplified: ["data","pagination"] };
        errorPlan = {};
        break;
      }
    case "getV2ActivitiesActivity": {
        
        
        let path = "/v2/activities/{activity}";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{activity}").join(encodeURIComponent(String(this.getNodeParameter("activity", itemIndex))));
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
        errorPlan = {"404":{"title":"Not Found"}};
        break;
      }
    case "patchV2ActivitiesActivity": {
        
        
        let path = "/v2/activities/{activity}";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{activity}").join(encodeURIComponent(String(this.getNodeParameter("activity", itemIndex))));
        setBodyField(body as IDataObject, {"name":"data","displayName":"Data","type":"object","required":true,"representation":"raw","fields":[{"name":"api_slug","displayName":"Api slug","description":"A unique, human-readable slug to access the activity through URLs and API calls. Should be formatted in snake case.","type":"string","example":"site_visits"},{"name":"plural_noun","displayName":"Plural noun","description":"The plural form of the activity's name.","type":"string","example":"Site visits"},{"name":"singular_noun","displayName":"Singular noun","description":"The singular form of the activity's name.","type":"string","example":"Site visit"}]}, this.getNodeParameter("data", itemIndex), this, itemIndex);
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "PATCH" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
        errorPlan = {"400":{"title":"Bad Request"},"403":{"title":"Forbidden"},"404":{"title":"Not Found"},"409":{"title":"Conflict"}};
        break;
      }
    case "postV2Activities": {
        
        
        const path = "/v2/activities";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        setBodyField(body as IDataObject, {"name":"data","displayName":"Data","type":"object","required":true,"representation":"raw","fields":[{"name":"api_slug","displayName":"Api slug","description":"A unique, human-readable slug to access the activity through URLs and API calls. Should be formatted in snake case.","type":"string","required":true,"example":"site_visits"},{"name":"extends","displayName":"Extends","description":"The schema the new activity extends, which supplies its inherited attributes. One of `activities`, `interactions`, `calls` or `emails`.","type":"string","required":true,"enum":["activities","interactions","calls","emails"],"example":"interactions"},{"name":"plural_noun","displayName":"Plural noun","description":"The plural form of the activity's name.","type":"string","required":true,"example":"Site visits"},{"name":"singular_noun","displayName":"Singular noun","description":"The singular form of the activity's name.","type":"string","required":true,"example":"Site visit"}]}, this.getNodeParameter("data", itemIndex), this, itemIndex);
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
        errorPlan = {"403":{"title":"Forbidden"},"409":{"title":"Conflict"}};
        break;
      }
    case "deleteV2ActivitiesActivityRecordsRecordId": {
        
        
        let path = "/v2/activities/{activity}/records/{record_id}";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{activity}").join(encodeURIComponent(String(this.getNodeParameter("activity", itemIndex))));
    path = path.split("{record_id}").join(encodeURIComponent(String(this.getNodeParameter("record_id", itemIndex))));
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "DELETE" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"403":{"title":"Forbidden"},"404":{"title":"Not Found"}};
        break;
      }
    case "getV2ActivitiesActivityRecordsRecordId": {
        
        
        let path = "/v2/activities/{activity}/records/{record_id}";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{activity}").join(encodeURIComponent(String(this.getNodeParameter("activity", itemIndex))));
    path = path.split("{record_id}").join(encodeURIComponent(String(this.getNodeParameter("record_id", itemIndex))));
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
        errorPlan = {"404":{"title":"Not Found"}};
        break;
      }
    case "patchV2ActivitiesActivityRecordsRecordId": {
        
        
        let path = "/v2/activities/{activity}/records/{record_id}";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{activity}").join(encodeURIComponent(String(this.getNodeParameter("activity", itemIndex))));
    path = path.split("{record_id}").join(encodeURIComponent(String(this.getNodeParameter("record_id", itemIndex))));
        setBodyField(body as IDataObject, {"name":"data","displayName":"Data","type":"object","required":true,"representation":"raw","fields":[{"name":"values","displayName":"Values","description":"Attribute values keyed by api_slug or attribute_id. Pass one value for single-select attributes or an array for multi-select values; see Attio's attribute type documentation for value formats.","type":"object","required":true,"example":{"41252299-f8c7-4b5e-99c9-4ff8321d2f96":"Text value","multiselect_attribute":["Select option 1","Select option 2"]},"representation":"raw","additionalValue":{"name":"value","displayName":"Value","type":"array","representation":"raw"}}]}, this.getNodeParameter("data", itemIndex), this, itemIndex);
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "PATCH" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
        errorPlan = {"400":{"title":"Bad Request"},"403":{"title":"Forbidden"},"404":{"title":"Not Found"},"409":{"title":"Conflict"}};
        break;
      }
    case "postV2ActivitiesActivityRecords": {
        
        
        let path = "/v2/activities/{activity}/records";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{activity}").join(encodeURIComponent(String(this.getNodeParameter("activity", itemIndex))));
        setBodyField(body as IDataObject, {"name":"data","displayName":"Data","type":"object","required":true,"representation":"raw","fields":[{"name":"values","displayName":"Values","description":"Attribute values keyed by api_slug or attribute_id. Pass one value for single-select attributes or an array for multi-select values; see Attio's attribute type documentation for value formats.","type":"object","required":true,"example":{"41252299-f8c7-4b5e-99c9-4ff8321d2f96":"Text value","multiselect_attribute":["Select option 1","Select option 2"]},"representation":"raw","additionalValue":{"name":"value","displayName":"Value","type":"array","representation":"raw"}}]}, this.getNodeParameter("data", itemIndex), this, itemIndex);
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
        errorPlan = {"400":{"title":"Bad Request"},"403":{"title":"Forbidden"},"404":{"title":"Not Found"},"409":{"title":"Conflict"}};
        break;
      }
    case "postV2ActivitiesActivityRecordsQuery": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        let path = "/v2/activities/{activity}/records/query";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{activity}").join(encodeURIComponent(String(this.getNodeParameter("activity", itemIndex))));
        if (additionalFields["filter"] !== undefined) setBodyField(body as IDataObject, {"name":"filter","displayName":"Filter","description":"An object used to filter results to a subset of results. Cannot be used together with `filter_view_id`. See the [full guide to filtering and sorting here](/rest-api/guides/filtering-and-sorting).","type":"object","example":{"name":"Ada Lovelace"},"representation":"raw","additionalValue":{"name":"value","displayName":"Value","type":"any"}}, additionalFields["filter"], this, itemIndex);
    if (additionalFields["limit"] !== undefined) setBodyField(body as IDataObject, {"name":"limit","displayName":"Limit","description":"The maximum number of results to return. Defaults to 500. See the [full guide to pagination here](/rest-api/guides/pagination).","type":"number","example":500}, additionalFields["limit"], this, itemIndex);
    if (additionalFields["offset"] !== undefined) setBodyField(body as IDataObject, {"name":"offset","displayName":"Offset","description":"The number of results to skip over before returning. Defaults to 0. See the [full guide to pagination here](/rest-api/guides/pagination).","type":"number","example":0}, additionalFields["offset"], this, itemIndex);
    if (additionalFields["sorts"] !== undefined) setBodyField(body as IDataObject, {"name":"sorts","displayName":"Sorts","description":"An object used to sort results. See the [full guide to filtering and sorting here](/rest-api/guides/filtering-and-sorting).","type":"array","example":[{"attribute":"name","direction":"asc","field":"last_name"}],"representation":"raw","items":{"name":"item","displayName":"Item","description":"Sort by attribute","type":"alternative","composition":"anyOf","representation":"raw","alternatives":[{"name":"alternative1","displayName":"Alternative1","description":"Sort by attribute","type":"object","representation":"raw","fields":[{"name":"attribute","displayName":"Attribute","description":"A slug or ID to identify the attribute to sort by.","type":"string","required":true},{"name":"direction","displayName":"Direction","description":"The direction to sort the results by.","type":"string","required":true,"enum":["asc","desc"]},{"name":"field","displayName":"Field","description":"Which field on the value to sort by e.g. \"last_name\" on a name value.","type":"string"}]},{"name":"alternative2","displayName":"Alternative2","description":"Sort by path","type":"object","representation":"raw","fields":[{"name":"direction","displayName":"Direction","description":"The direction to sort the results by.","type":"string","required":true,"enum":["asc","desc"]},{"name":"field","displayName":"Field","description":"Which field on the value to sort by e.g. \"last_name\" on a name value.","type":"string"},{"name":"path","displayName":"Path","description":"Use path to traverse record-reference attributes and list-entry parent records. Each tuple contains a list or object ID followed by an attribute ID; the first tuple starts at the queried list or object.","type":"array","required":true,"representation":"raw","items":{"name":"item","displayName":"Item","type":"array","representation":"raw","items":{"name":"item","displayName":"Item","description":"The slug or ID of the object e.g. \"people\".","type":"alternative","composition":"anyOf","representation":"raw","alternatives":[{"name":"alternative1","displayName":"Alternative1","description":"The slug or ID of the object e.g. \"people\".","type":"string"},{"name":"alternative2","displayName":"Alternative2","description":"A slug or ID to identify the attribute to sort by.","type":"string"}]}}}]}]}}, additionalFields["sorts"], this, itemIndex);
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
        errorPlan = {"400":{"title":"Bad Request"},"404":{"title":"Not Found"}};
        break;
      }
    case "putV2ActivitiesActivityRecords": {
        
        
        let path = "/v2/activities/{activity}/records";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{activity}").join(encodeURIComponent(String(this.getNodeParameter("activity", itemIndex))));
    qs["matching_attribute"] = this.getNodeParameter("matching_attribute", itemIndex);
        setBodyField(body as IDataObject, {"name":"data","displayName":"Data","type":"object","required":true,"representation":"raw","fields":[{"name":"values","displayName":"Values","description":"Attribute values keyed by api_slug or attribute_id. Pass one value for single-select attributes or an array for multi-select values; see Attio's attribute type documentation for value formats.","type":"object","required":true,"example":{"41252299-f8c7-4b5e-99c9-4ff8321d2f96":"Text value","multiselect_attribute":["Select option 1","Select option 2"]},"representation":"raw","additionalValue":{"name":"value","displayName":"Value","type":"array","representation":"raw"}}]}, this.getNodeParameter("data", itemIndex), this, itemIndex);
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "PUT" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
        errorPlan = {"400":{"title":"Bad Request"},"403":{"title":"Forbidden"},"404":{"title":"Not Found"},"409":{"title":"Conflict"}};
        break;
      }
    case "putV2ActivitiesActivityRecordsRecordId": {
        
        
        let path = "/v2/activities/{activity}/records/{record_id}";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{activity}").join(encodeURIComponent(String(this.getNodeParameter("activity", itemIndex))));
    path = path.split("{record_id}").join(encodeURIComponent(String(this.getNodeParameter("record_id", itemIndex))));
        setBodyField(body as IDataObject, {"name":"data","displayName":"Data","type":"object","required":true,"representation":"raw","fields":[{"name":"values","displayName":"Values","description":"Attribute values keyed by api_slug or attribute_id. Pass one value for single-select attributes or an array for multi-select values; see Attio's attribute type documentation for value formats.","type":"object","required":true,"example":{"41252299-f8c7-4b5e-99c9-4ff8321d2f96":"Text value","multiselect_attribute":["Select option 1","Select option 2"]},"representation":"raw","additionalValue":{"name":"value","displayName":"Value","type":"array","representation":"raw"}}]}, this.getNodeParameter("data", itemIndex), this, itemIndex);
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "PUT" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
        errorPlan = {"400":{"title":"Bad Request"},"403":{"title":"Forbidden"},"404":{"title":"Not Found"},"409":{"title":"Conflict"}};
        break;
      }
    case "getV2TargetIdentifierAttributes": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        let path = "/v2/{target}/{identifier}/attributes";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{target}").join(encodeURIComponent(String(this.getNodeParameter("target", itemIndex))));
    path = path.split("{identifier}").join(encodeURIComponent(String(this.getNodeParameter("identifier", itemIndex))));
    if (additionalFields["limit"] !== undefined) qs["limit"] = additionalFields["limit"];
    if (additionalFields["offset"] !== undefined) qs["offset"] = additionalFields["offset"];
    if (additionalFields["show_archived"] !== undefined) qs["show_archived"] = additionalFields["show_archived"];
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
        errorPlan = {};
        break;
      }
    case "getV2TargetIdentifierAttributesAttribute": {
        
        
        let path = "/v2/{target}/{identifier}/attributes/{attribute}";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{target}").join(encodeURIComponent(String(this.getNodeParameter("target", itemIndex))));
    path = path.split("{identifier}").join(encodeURIComponent(String(this.getNodeParameter("identifier", itemIndex))));
    path = path.split("{attribute}").join(encodeURIComponent(String(this.getNodeParameter("attribute", itemIndex))));
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
        errorPlan = {"404":{"title":"Not Found"}};
        break;
      }
    case "getV2TargetIdentifierAttributesAttributeOptions": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        let path = "/v2/{target}/{identifier}/attributes/{attribute}/options";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{target}").join(encodeURIComponent(String(this.getNodeParameter("target", itemIndex))));
    path = path.split("{identifier}").join(encodeURIComponent(String(this.getNodeParameter("identifier", itemIndex))));
    path = path.split("{attribute}").join(encodeURIComponent(String(this.getNodeParameter("attribute", itemIndex))));
    if (additionalFields["show_archived"] !== undefined) qs["show_archived"] = additionalFields["show_archived"];
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
        errorPlan = {"404":{"title":"Not Found"}};
        break;
      }
    case "getV2TargetIdentifierAttributesAttributeStatuses": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        let path = "/v2/{target}/{identifier}/attributes/{attribute}/statuses";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{target}").join(encodeURIComponent(String(this.getNodeParameter("target", itemIndex))));
    path = path.split("{identifier}").join(encodeURIComponent(String(this.getNodeParameter("identifier", itemIndex))));
    path = path.split("{attribute}").join(encodeURIComponent(String(this.getNodeParameter("attribute", itemIndex))));
    if (additionalFields["show_archived"] !== undefined) qs["show_archived"] = additionalFields["show_archived"];
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
        errorPlan = {"404":{"title":"Not Found"}};
        break;
      }
    case "patchV2TargetIdentifierAttributesAttribute": {
        
        
        let path = "/v2/{target}/{identifier}/attributes/{attribute}";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{target}").join(encodeURIComponent(String(this.getNodeParameter("target", itemIndex))));
    path = path.split("{identifier}").join(encodeURIComponent(String(this.getNodeParameter("identifier", itemIndex))));
    path = path.split("{attribute}").join(encodeURIComponent(String(this.getNodeParameter("attribute", itemIndex))));
        setBodyField(body as IDataObject, {"name":"data","displayName":"Data","type":"object","required":true,"representation":"raw","fields":[{"name":"api_slug","displayName":"Api slug","description":"A unique, human-readable slug to access the attribute through URLs and API calls. Formatted in snake case.","type":"string","example":"my_attribute"},{"name":"config","displayName":"Config","description":"Additional, type-dependent configuration for the attribute.","type":"object","representation":"raw","fields":[{"name":"currency","displayName":"Currency","description":"Configuration available for attributes of type \"currency\".","type":"object","representation":"raw","fields":[{"name":"default_currency_code","displayName":"Default currency code","description":"The ISO4217 code representing the currency that values for this attribute should be stored in.","type":"string","required":true,"enum":["ARS","AUD","BRL","BGN","CAD","CLP","CNY","COP","CZK","DKK","EGP","EUR","FJD","GHS","HKD","HUF","ISK","INR","IDR","ILS","JPY","KES","KRW","MYR","MXN","NTD","NZD","NGN","NOK","OMR","XPF","PEN","PHP","PLN","GBP","QAR","RWF","SAR","SGD","ZAR","SEK","CHF","THB","TRY","AED","UYU","USD"],"example":"USD"},{"name":"display_type","displayName":"Display type","description":"How the currency should be displayed across the app. \"code\" will display the ISO currency code e.g. \"USD\", \"name\" will display the localized currency name e.g. \"British pound\", \"narrowSymbol\" will display \"$1\" instead of \"US$1\" and \"symbol\" will display a localized currency symbol such as \"$\".","type":"string","required":true,"enum":["code","name","narrowSymbol","symbol"],"example":"symbol"}]},{"name":"record_reference","displayName":"Record reference","description":"Configuration available for attributes of type \"record-reference\".","type":"object","representation":"raw","fields":[{"name":"allowed_objects","displayName":"Allowed objects","description":"A list of slugs or UUIDs to indicate which objects records are allowed to belong to. If `relationship` is also provided, this must contain only the relationship object.","type":"array","required":true,"representation":"raw","items":{"name":"item","displayName":"Item","type":"string","example":"people"}}]}]},{"name":"default_value","displayName":"Default value","description":"Default value for the attribute. Static defaults use the supplied value; dynamic defaults resolve at creation time. Supported defaults depend on the attribute type. Default values are unavailable on people and company objects.","type":"alternative","example":{"template":[{"value":5}],"type":"static"},"composition":"oneOf","representation":"raw","nullable":true,"alternatives":[{"name":"alternative1","displayName":"Alternative1","type":"object","representation":"raw","fields":[{"name":"template","displayName":"Template","description":"For actor reference attributes, you may pass a dynamic value of `\"current-user\"`. When creating new records or entries, this will cause the actor reference value to be populated with either the workspace member or API token that created the record/entry.","type":"alternative","required":true,"composition":"anyOf","representation":"raw","alternatives":[{"name":"alternative1","displayName":"Alternative1","description":"For actor reference attributes, you may pass a dynamic value of `\"current-user\"`. When creating new records or entries, this will cause the actor reference value to be populated with either the workspace member or API token that created the record/entry.","type":"string","enum":["current-user"],"example":"current-user"},{"name":"alternative2","displayName":"Alternative2","description":"Timestamp attributes may use an ISO 8601 duration as a dynamic value. For example, `\"P1M\"` would set the value to the current time plus one month.","type":"string","example":"P1M"},{"name":"alternative3","displayName":"Alternative3","description":"Date attributes may use an ISO 8601 duration as a dynamic value. For example, `\"P1M\"` would set the value to the current time plus one month.","type":"string","example":"P1M"}]},{"name":"type","displayName":"Type","type":"string","required":true,"enum":["dynamic"],"example":"dynamic"}]},{"name":"alternative2","displayName":"Alternative2","type":"object","representation":"raw","fields":[{"name":"template","displayName":"Template","type":"array","required":true,"example":[{"value":5}],"representation":"raw","items":{"name":"item","displayName":"Item","description":"A union of possible value types, as required in request bodies.","type":"alternative","composition":"anyOf","representation":"raw","alternatives":[{"name":"alternative1","displayName":"Alternative1","type":"object","representation":"raw","fields":[{"name":"referenced_actor_id","displayName":"Referenced actor id","description":"The ID of the referenced Actor.","type":"string","format":"uuid","required":true,"example":"50cf242c-7fa3-4cad-87d0-75b1af71c57b"},{"name":"referenced_actor_type","displayName":"Referenced actor type","description":"The type of the referenced actor. Currently, only workspace members can be written into actor reference attributes. [Read more information on actor types here](/docs/actors).","type":"string","required":true,"enum":["workspace-member"],"example":"workspace-member"}]},{"name":"alternative2","displayName":"Alternative2","type":"object","representation":"raw","fields":[{"name":"workspace_member_email_address","displayName":"Workspace member email address","description":"Workspace member actors can be referenced by email address as well as actor ID.","type":"string","required":true,"example":"alice@attio.com"}]},{"name":"alternative3","displayName":"Alternative3","type":"object","representation":"raw","fields":[{"name":"value","displayName":"Value","description":"A boolean representing whether the checkbox is checked or not. The string values 'true' and 'false' are also accepted.","type":"boolean","required":true,"example":true}]},{"name":"alternative4","displayName":"Alternative4","type":"object","representation":"raw","fields":[{"name":"currency_value","displayName":"Currency value","description":"A numerical representation of the currency value. A decimal with a max of 4 decimal places.","type":"number","required":true,"example":99}]},{"name":"alternative5","displayName":"Alternative5","type":"object","representation":"raw","fields":[{"name":"value","displayName":"Value","description":"A date is a calendar year, month, and day without a time zone. Time components are removed; timezone offsets may change the resulting UTC calendar day.","type":"string","required":true,"example":"2023-01-01"}]},{"name":"alternative6","displayName":"Alternative6","type":"object","representation":"raw","fields":[{"name":"domain","displayName":"Domain","description":"The full domain of the website.","type":"string","example":"app.attio.com"}]},{"name":"alternative7","displayName":"Alternative7","type":"object","representation":"raw","fields":[{"name":"email_address","displayName":"Email address","description":"An email address string","type":"string","example":"alice@app.attio.com"}]},{"name":"alternative8","displayName":"Alternative8","type":"object","representation":"raw","fields":[{"name":"target_object","displayName":"Target object","description":"A UUID or slug to identify the object that the referenced record belongs to.","type":"string","required":true,"example":"people"},{"name":"target_record_id","displayName":"Target record id","description":"A UUID to identify the referenced record.","type":"string","format":"uuid","required":true,"example":"891dcbfc-9141-415d-9b2a-2238a6cc012d"}]},{"name":"alternative9","displayName":"Alternative9","type":"object","example":{"matching_attribute_id_123":[{"value":"matching_attribute_id_123"}],"target_object":"people"},"representation":"raw","fields":[{"name":"[slug_or_id_of_matching_attribute]","displayName":"[slug or id of matching attribute]","description":"Reference a record by ID or one matching attribute. Set target_object, provide the matching attribute slug or ID, and pass one value in that attribute's expected format.","type":"array","required":true,"representation":"raw","items":{"name":"item","displayName":"Item","type":"alternative","composition":"anyOf","representation":"raw","alternatives":[{"name":"alternative1","displayName":"Alternative1","type":"object","representation":"raw","fields":[{"name":"domain","displayName":"Domain","description":"The full domain of the website.","type":"string","example":"app.attio.com"}]},{"name":"alternative2","displayName":"Alternative2","type":"object","representation":"raw","fields":[{"name":"email_address","displayName":"Email address","description":"An email address string","type":"string","example":"alice@app.attio.com"}]},{"name":"alternative3","displayName":"Alternative3","type":"object","representation":"raw","fields":[{"name":"value","displayName":"Value","description":"Numbers are persisted as 64 bit floats.","type":"number","example":17224912}]},{"name":"alternative4","displayName":"Alternative4","type":"object","representation":"raw","fields":[{"name":"country_code","displayName":"Country code","description":"The ISO 3166-1 alpha-2 country code representing the country that this phone number belongs to.","type":"string","enum":["AF","AX","AL","DZ","AS","AD","AO","AI","AQ","AG","AR","AM","AW","AU","AT","AZ","BS","BH","BD","BB","BY","BE","BZ","BJ","BM","BT","BO","BA","BW","BV","BR","IO","BN","BG","BF","BI","KH","CM","CA","CV","KY","CF","TD","CL","CN","CX","CC","CO","KM","CG","CD","CK","CR","CI","HR","CU","CW","CY","CZ","DK","DJ","DM","DO","EC","EG","SV","GQ","ER","EE","ET","FK","FO","FJ","FI","FR","GF","PF","TF","GA","GM","GE","DE","GH","GI","GR","GL","GD","GP","GU","GT","GG","GN","GW","GY","HT","HM","VA","HN","HK","HU","IS","IN","ID","IR","IQ","IE","IM","IL","IT","JM","JP","JE","JO","KZ","KE","KI","KR","KW","KG","LA","LV","LB","LS","LR","LY","LI","LT","LU","MO","MK","MG","MW","MY","MV","ML","MT","MH","MQ","MR","MU","YT","MX","FM","MD","MC","MN","ME","MS","MA","MZ","MM","NA","NR","NP","NL","AN","NC","NZ","NI","NE","NG","NU","NF","MP","NO","OM","PK","PW","PS","PA","PG","PY","PE","PH","PN","PL","PT","PR","QA","RE","RO","RU","RW","BL","SH","KN","LC","MF","PM","VC","WS","SM","ST","SA","SN","SS","RS","SC","SL","SG","SK","SI","SB","SO","ZA","GS","ES","LK","SD","SR","SJ","SZ","SE","CH","SY","TW","TJ","TZ","TH","TL","TG","TK","TO","TT","TN","TR","TM","TC","TV","UG","UA","AE","GB","US","UM","UY","UZ","VU","VE","VN","VG","VI","WF","EH","YE","ZM","ZW","BQ","KP","SX","XK","AC"],"example":"GB","nullable":true},{"name":"original_phone_number","displayName":"Original phone number","description":"The raw, original phone number, as inputted.","type":"string","example":"07234172834"}]},{"name":"alternative5","displayName":"Alternative5","type":"object","representation":"raw","fields":[{"name":"value","displayName":"Value","description":"A raw text field. Values are limited to 10MB.","type":"string"}]}]}},{"name":"target_object","displayName":"Target object","description":"A UUID or slug to identify the object that the referenced record belongs to.","type":"string","required":true,"example":"people"}]},{"name":"alternative10","displayName":"Alternative10","type":"object","representation":"raw","fields":[{"name":"interacted_at","displayName":"Interacted at","description":"When the interaction occurred.","type":"string","format":"date-time","required":true,"example":"2023-01-01T15:00:00.000000000Z"},{"name":"interaction_type","displayName":"Interaction type","description":"The type of interaction e.g. calendar or email.","type":"string","required":true,"enum":["activity","email","meeting","calendar-event"],"example":"email"},{"name":"owner_actor","displayName":"Owner actor","description":"The actor that created this value.","type":"object","required":true,"example":{"id":"50cf242c-7fa3-4cad-87d0-75b1af71c57b","type":"workspace-member"},"representation":"raw","fields":[{"name":"id","displayName":"Id","description":"An ID to identify the actor.","type":"string","nullable":true},{"name":"type","displayName":"Type","description":"The type of actor. [Read more information on actor types here](/docs/actors).","type":"string","enum":["api-token","workspace-member","system","app"],"nullable":true}]}]},{"name":"alternative11","displayName":"Alternative11","type":"object","representation":"raw","fields":[{"name":"country_code","displayName":"Country code","description":"The ISO 3166-1 alpha-2 country code for the country this location is in.","type":"string","required":true,"enum":["AF","AX","AL","DZ","AS","AD","AO","AI","AQ","AG","AR","AM","AW","AU","AT","AZ","BS","BH","BD","BB","BY","BE","BZ","BJ","BM","BT","BO","BA","BW","BV","BR","IO","BN","BG","BF","BI","KH","CM","CA","CV","KY","CF","TD","CL","CN","CX","CC","CO","KM","CG","CD","CK","CR","CI","HR","CU","CW","CY","CZ","DK","DJ","DM","DO","EC","EG","SV","GQ","ER","EE","ET","FK","FO","FJ","FI","FR","GF","PF","TF","GA","GM","GE","DE","GH","GI","GR","GL","GD","GP","GU","GT","GG","GN","GW","GY","HT","HM","VA","HN","HK","HU","IS","IN","ID","IR","IQ","IE","IM","IL","IT","JM","JP","JE","JO","KZ","KE","KI","KR","KW","KG","LA","LV","LB","LS","LR","LY","LI","LT","LU","MO","MK","MG","MW","MY","MV","ML","MT","MH","MQ","MR","MU","YT","MX","FM","MD","MC","MN","ME","MS","MA","MZ","MM","NA","NR","NP","NL","AN","NC","NZ","NI","NE","NG","NU","NF","MP","NO","OM","PK","PW","PS","PA","PG","PY","PE","PH","PN","PL","PT","PR","QA","RE","RO","RU","RW","BL","SH","KN","LC","MF","PM","VC","WS","SM","ST","SA","SN","SS","RS","SC","SL","SG","SK","SI","SB","SO","ZA","GS","ES","LK","SD","SR","SJ","SZ","SE","CH","SY","TW","TJ","TZ","TH","TL","TG","TK","TO","TT","TN","TR","TM","TC","TV","UG","UA","AE","GB","US","UM","UY","UZ","VU","VE","VN","VG","VI","WF","EH","YE","ZM","ZW","BQ","KP","SX","XK","AC"],"example":"US","nullable":true},{"name":"latitude","displayName":"Latitude","description":"The latitude of the location. Validated by the regular expression `/^[-+]?([1-8]?\\d(\\.\\d+)?|90(\\.0+)?)$/`. Values are stored with up to 9 decimal places of precision. Note that this value is not currently represented in the UI but will be persisted and readable through API calls.}","type":"string","required":true,"example":"37.331741","pattern":"^[-+]?([1-8]?\\d(\\.\\d+)?|90(\\.0+)?)$","nullable":true},{"name":"line_1","displayName":"Line 1","description":"The first line of the address. Note that this value is not currently represented in the UI but will be persisted and readable through API calls.","type":"string","required":true,"example":"1 Infinite Loop","nullable":true},{"name":"line_2","displayName":"Line 2","description":"The second line of the address. Note that this value is not currently represented in the UI but will be persisted and readable through API calls.","type":"string","required":true,"example":"Block 1","nullable":true},{"name":"line_3","displayName":"Line 3","description":"The third line of the address. Note that this value is not currently represented in the UI but will be persisted and readable through API calls.","type":"string","required":true,"example":"Hilldrop Estate","nullable":true},{"name":"line_4","displayName":"Line 4","description":"The fourth line of the address. Note that this value is not currently represented in the UI but will be persisted and readable through API calls.","type":"string","required":true,"example":"Westborough","nullable":true},{"name":"locality","displayName":"Locality","description":"The town, neighborhood or area the location is in.","type":"string","required":true,"example":"Cupertino","nullable":true},{"name":"longitude","displayName":"Longitude","description":"The longitude of the location. Validated by the regular expression `/^[-+]?(180(\\.0+)?|((1[0-7]\\d)|([1-9]?\\d))(\\.\\d+)?)$/`. Values are stored with up to 9 decimal places of precision. Note that this value is not currently represented in the UI but will be persisted and readable through API calls.}","type":"string","required":true,"example":"-122.030333","pattern":"^[-+]?(180(\\.0+)?|((1[0-7]\\d)|([1-9]?\\d))(\\.\\d+)?)$","nullable":true},{"name":"postcode","displayName":"Postcode","description":"The postcode or zip code for the location. Note that this value is not currently represented in the UI but will be persisted and readable through API calls.}","type":"string","required":true,"example":"95014","nullable":true},{"name":"region","displayName":"Region","description":"The state, county, province or region that the location is in.","type":"string","required":true,"example":"CA","nullable":true}]},{"name":"alternative12","displayName":"Alternative12","type":"object","representation":"raw","fields":[{"name":"value","displayName":"Value","description":"Numbers are persisted as 64 bit floats.","type":"number","required":true,"example":42}]},{"name":"alternative13","displayName":"Alternative13","type":"object","representation":"raw","fields":[{"name":"first_name","displayName":"First name","description":"The first name.","type":"string","example":"Ada"},{"name":"full_name","displayName":"Full name","description":"The full name.","type":"string","example":"Ada Lovelace"},{"name":"last_name","displayName":"Last name","description":"The last name.","type":"string","example":"Lovelace"}]},{"name":"alternative14","displayName":"Alternative14","type":"object","representation":"raw","fields":[{"name":"country_code","displayName":"Country code","description":"The ISO 3166-1 alpha-2 country code representing the country that this phone number belongs to. Optional if `original_phone_number` includes a country code prefix.","type":"string","enum":["AF","AX","AL","DZ","AS","AD","AO","AI","AQ","AG","AR","AM","AW","AU","AT","AZ","BS","BH","BD","BB","BY","BE","BZ","BJ","BM","BT","BO","BA","BW","BV","BR","IO","BN","BG","BF","BI","KH","CM","CA","CV","KY","CF","TD","CL","CN","CX","CC","CO","KM","CG","CD","CK","CR","CI","HR","CU","CW","CY","CZ","DK","DJ","DM","DO","EC","EG","SV","GQ","ER","EE","ET","FK","FO","FJ","FI","FR","GF","PF","TF","GA","GM","GE","DE","GH","GI","GR","GL","GD","GP","GU","GT","GG","GN","GW","GY","HT","HM","VA","HN","HK","HU","IS","IN","ID","IR","IQ","IE","IM","IL","IT","JM","JP","JE","JO","KZ","KE","KI","KR","KW","KG","LA","LV","LB","LS","LR","LY","LI","LT","LU","MO","MK","MG","MW","MY","MV","ML","MT","MH","MQ","MR","MU","YT","MX","FM","MD","MC","MN","ME","MS","MA","MZ","MM","NA","NR","NP","NL","AN","NC","NZ","NI","NE","NG","NU","NF","MP","NO","OM","PK","PW","PS","PA","PG","PY","PE","PH","PN","PL","PT","PR","QA","RE","RO","RU","RW","BL","SH","KN","LC","MF","PM","VC","WS","SM","ST","SA","SN","SS","RS","SC","SL","SG","SK","SI","SB","SO","ZA","GS","ES","LK","SD","SR","SJ","SZ","SE","CH","SY","TW","TJ","TZ","TH","TL","TG","TK","TO","TT","TN","TR","TM","TC","TV","UG","UA","AE","GB","US","UM","UY","UZ","VU","VE","VN","VG","VI","WF","EH","YE","ZM","ZW","BQ","KP","SX","XK","AC"],"example":"GB","nullable":true},{"name":"original_phone_number","displayName":"Original phone number","description":"A phone number which is either a) prefixed with a country code (e.g. `+44....`) or b) a local number, where `country_code` is specified in addition.","type":"string","required":true,"example":"+15558675309"}]},{"name":"alternative15","displayName":"Alternative15","type":"object","representation":"raw","fields":[{"name":"status","displayName":"Status","description":"The UUID or status title identifying the selected status.","type":"string","required":true,"example":"In Progress"}]},{"name":"alternative16","displayName":"Alternative16","type":"object","representation":"raw","fields":[{"name":"value","displayName":"Value","description":"A number between 0 and 5 (inclusive) to represent a star rating.","type":"number","required":true,"example":3}]},{"name":"alternative17","displayName":"Alternative17","type":"object","representation":"raw","fields":[{"name":"option","displayName":"Option","description":"The UUID or select option title identifying the selected select option.","type":"string","required":true,"example":"Medium"}]},{"name":"alternative18","displayName":"Alternative18","type":"object","representation":"raw","fields":[{"name":"value","displayName":"Value","description":"A raw text field. Values are limited to 10MB.","type":"string","required":true,"example":"Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."}]},{"name":"alternative19","displayName":"Alternative19","type":"object","representation":"raw","fields":[{"name":"value","displayName":"Value","description":"A timestamp is an ISO 8601 date-time. Missing timezone information defaults to UTC; returned timestamps are always in UTC. Attio may coerce partial dates or times to a complete timestamp.","type":"string","format":"date","required":true,"example":"2023-01-01T15:00:00.000000000Z"}]}]}},{"name":"type","displayName":"Type","type":"string","required":true,"enum":["static"],"example":"static"}]}]},{"name":"description","displayName":"Description","description":"A text description for the attribute.","type":"string","example":"Lorem ipsum","nullable":true},{"name":"is_archived","displayName":"Is archived","description":"Whether the attribute has been archived or not. See our [archiving guide](/docs/archiving-vs-deleting) for more information on archiving.","type":"boolean","example":false},{"name":"is_required","displayName":"Is required","description":"When `is_required` is `true`, new records/entries must have a value for this attribute. If `false`, values may be `null`. This value does not affect existing data and you do not need to backfill `null` values if changing `is_required` from `false` to `true`.","type":"boolean","example":true},{"name":"is_unique","displayName":"Is unique","description":"Whether or not new values for this attribute must be unique. Uniqueness restrictions are only applied to new data and do not apply retroactively to previously created data.","type":"boolean","example":true},{"name":"title","displayName":"Title","description":"The name of the attribute. The title will be visible across Attio's UI.","type":"string","example":"Your Attribute"}]}, this.getNodeParameter("data", itemIndex), this, itemIndex);
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "PATCH" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
        errorPlan = {"400":{"title":"Bad Request"},"403":{"title":"Forbidden"},"404":{"title":"Not Found"}};
        break;
      }
    case "patchV2TargetIdentifierAttributesAttributeOptionsOption": {
        
        
        let path = "/v2/{target}/{identifier}/attributes/{attribute}/options/{option}";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{target}").join(encodeURIComponent(String(this.getNodeParameter("target", itemIndex))));
    path = path.split("{identifier}").join(encodeURIComponent(String(this.getNodeParameter("identifier", itemIndex))));
    path = path.split("{attribute}").join(encodeURIComponent(String(this.getNodeParameter("attribute", itemIndex))));
    path = path.split("{option}").join(encodeURIComponent(String(this.getNodeParameter("option", itemIndex))));
        setBodyField(body as IDataObject, {"name":"data","displayName":"Data","type":"object","required":true,"representation":"raw","fields":[{"name":"is_archived","displayName":"Is archived","description":"Whether or not to archive the select option. See our [archiving guide](/docs/archiving-vs-deleting) for more information on archiving.","type":"boolean","example":false},{"name":"title","displayName":"Title","description":"The Title of the select option","type":"string","example":"Medium"}]}, this.getNodeParameter("data", itemIndex), this, itemIndex);
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "PATCH" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
        errorPlan = {"400":{"title":"Bad Request"},"403":{"title":"Forbidden"},"404":{"title":"Not Found"},"409":{"title":"Conflict"}};
        break;
      }
    case "patchV2TargetIdentifierAttributesAttributeStatusesStatus": {
        
        
        let path = "/v2/{target}/{identifier}/attributes/{attribute}/statuses/{status}";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{target}").join(encodeURIComponent(String(this.getNodeParameter("target", itemIndex))));
    path = path.split("{identifier}").join(encodeURIComponent(String(this.getNodeParameter("identifier", itemIndex))));
    path = path.split("{attribute}").join(encodeURIComponent(String(this.getNodeParameter("attribute", itemIndex))));
    path = path.split("{status}").join(encodeURIComponent(String(this.getNodeParameter("status", itemIndex))));
        setBodyField(body as IDataObject, {"name":"data","displayName":"Data","type":"object","required":true,"representation":"raw","fields":[{"name":"celebration_enabled","displayName":"Celebration enabled","description":"Whether arriving at this status triggers a celebration effect","type":"boolean","default":false,"example":true},{"name":"is_archived","displayName":"Is archived","description":"Whether or not to archive the status. See our [archiving guide](/docs/archiving-vs-deleting) for more information on archiving.","type":"boolean","example":false},{"name":"target_time_in_status","displayName":"Target time in status","description":"Target time for a record to spend in given status expressed as a ISO-8601 duration string","type":"string","example":"P0Y0M1DT0H0M0S","pattern":"P(?:(\\d+Y)?(\\d+M)?(\\d+W)?(\\d+D)?(?:T(\\d+(?:[\\.,]\\d+)?H)?(\\d+(?:[\\.,]\\d+)?M)?(\\d+(?:[\\.,]\\d+)?S)?)?)","nullable":true},{"name":"title","displayName":"Title","description":"The Title of the status","type":"string","example":"In Progress"}]}, this.getNodeParameter("data", itemIndex), this, itemIndex);
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "PATCH" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
        errorPlan = {"400":{"title":"Bad Request"},"403":{"title":"Forbidden"},"404":{"title":"Not Found"},"409":{"title":"Conflict"}};
        break;
      }
    case "postV2TargetIdentifierAttributes": {
        
        
        let path = "/v2/{target}/{identifier}/attributes";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{target}").join(encodeURIComponent(String(this.getNodeParameter("target", itemIndex))));
    path = path.split("{identifier}").join(encodeURIComponent(String(this.getNodeParameter("identifier", itemIndex))));
        setBodyField(body as IDataObject, {"name":"data","displayName":"Data","type":"object","required":true,"representation":"raw","fields":[{"name":"api_slug","displayName":"Api slug","description":"A unique, human-readable slug to access the attribute through URLs and API calls. Formatted in snake case.","type":"string","required":true,"example":"my_attribute"},{"name":"config","displayName":"Config","type":"object","required":true,"representation":"raw","fields":[{"name":"currency","displayName":"Currency","description":"Configuration available for attributes of type \"currency\".","type":"object","representation":"raw","fields":[{"name":"default_currency_code","displayName":"Default currency code","description":"The ISO4217 code representing the currency that values for this attribute should be stored in.","type":"string","required":true,"enum":["ARS","AUD","BRL","BGN","CAD","CLP","CNY","COP","CZK","DKK","EGP","EUR","FJD","GHS","HKD","HUF","ISK","INR","IDR","ILS","JPY","KES","KRW","MYR","MXN","NTD","NZD","NGN","NOK","OMR","XPF","PEN","PHP","PLN","GBP","QAR","RWF","SAR","SGD","ZAR","SEK","CHF","THB","TRY","AED","UYU","USD"],"example":"USD"},{"name":"display_type","displayName":"Display type","description":"How the currency should be displayed across the app. \"code\" will display the ISO currency code e.g. \"USD\", \"name\" will display the localized currency name e.g. \"British pound\", \"narrowSymbol\" will display \"$1\" instead of \"US$1\" and \"symbol\" will display a localized currency symbol such as \"$\".","type":"string","required":true,"enum":["code","name","narrowSymbol","symbol"],"example":"symbol"}]},{"name":"record_reference","displayName":"Record reference","description":"Configuration available for attributes of type \"record-reference\".","type":"object","representation":"raw","fields":[{"name":"allowed_objects","displayName":"Allowed objects","description":"A list of slugs or UUIDs to indicate which objects records are allowed to belong to. If `relationship` is also provided, this must contain only the relationship object.","type":"array","required":true,"representation":"raw","items":{"name":"item","displayName":"Item","type":"string","example":"people"}}]}]},{"name":"default_value","displayName":"Default value","description":"Default value for the attribute. Static defaults use the supplied value; dynamic defaults resolve at creation time. Supported defaults depend on the attribute type. Default values are unavailable on people and company objects.","type":"alternative","example":{"template":[{"value":5}],"type":"static"},"composition":"oneOf","representation":"raw","nullable":true,"alternatives":[{"name":"alternative1","displayName":"Alternative1","type":"object","representation":"raw","fields":[{"name":"template","displayName":"Template","description":"For actor reference attributes, you may pass a dynamic value of `\"current-user\"`. When creating new records or entries, this will cause the actor reference value to be populated with either the workspace member or API token that created the record/entry.","type":"alternative","required":true,"composition":"anyOf","representation":"raw","alternatives":[{"name":"alternative1","displayName":"Alternative1","description":"For actor reference attributes, you may pass a dynamic value of `\"current-user\"`. When creating new records or entries, this will cause the actor reference value to be populated with either the workspace member or API token that created the record/entry.","type":"string","enum":["current-user"],"example":"current-user"},{"name":"alternative2","displayName":"Alternative2","description":"Timestamp attributes may use an ISO 8601 duration as a dynamic value. For example, `\"P1M\"` would set the value to the current time plus one month.","type":"string","example":"P1M"},{"name":"alternative3","displayName":"Alternative3","description":"Date attributes may use an ISO 8601 duration as a dynamic value. For example, `\"P1M\"` would set the value to the current time plus one month.","type":"string","example":"P1M"}]},{"name":"type","displayName":"Type","type":"string","required":true,"enum":["dynamic"],"example":"dynamic"}]},{"name":"alternative2","displayName":"Alternative2","type":"object","representation":"raw","fields":[{"name":"template","displayName":"Template","type":"array","required":true,"example":[{"value":5}],"representation":"raw","items":{"name":"item","displayName":"Item","description":"A union of possible value types, as required in request bodies.","type":"alternative","composition":"anyOf","representation":"raw","alternatives":[{"name":"alternative1","displayName":"Alternative1","type":"object","representation":"raw","fields":[{"name":"referenced_actor_id","displayName":"Referenced actor id","description":"The ID of the referenced Actor.","type":"string","format":"uuid","required":true,"example":"50cf242c-7fa3-4cad-87d0-75b1af71c57b"},{"name":"referenced_actor_type","displayName":"Referenced actor type","description":"The type of the referenced actor. Currently, only workspace members can be written into actor reference attributes. [Read more information on actor types here](/docs/actors).","type":"string","required":true,"enum":["workspace-member"],"example":"workspace-member"}]},{"name":"alternative2","displayName":"Alternative2","type":"object","representation":"raw","fields":[{"name":"workspace_member_email_address","displayName":"Workspace member email address","description":"Workspace member actors can be referenced by email address as well as actor ID.","type":"string","required":true,"example":"alice@attio.com"}]},{"name":"alternative3","displayName":"Alternative3","type":"object","representation":"raw","fields":[{"name":"value","displayName":"Value","description":"A boolean representing whether the checkbox is checked or not. The string values 'true' and 'false' are also accepted.","type":"boolean","required":true,"example":true}]},{"name":"alternative4","displayName":"Alternative4","type":"object","representation":"raw","fields":[{"name":"currency_value","displayName":"Currency value","description":"A numerical representation of the currency value. A decimal with a max of 4 decimal places.","type":"number","required":true,"example":99}]},{"name":"alternative5","displayName":"Alternative5","type":"object","representation":"raw","fields":[{"name":"value","displayName":"Value","description":"A date is a calendar year, month, and day without a time zone. Time components are removed; timezone offsets may change the resulting UTC calendar day.","type":"string","required":true,"example":"2023-01-01"}]},{"name":"alternative6","displayName":"Alternative6","type":"object","representation":"raw","fields":[{"name":"domain","displayName":"Domain","description":"The full domain of the website.","type":"string","example":"app.attio.com"}]},{"name":"alternative7","displayName":"Alternative7","type":"object","representation":"raw","fields":[{"name":"email_address","displayName":"Email address","description":"An email address string","type":"string","example":"alice@app.attio.com"}]},{"name":"alternative8","displayName":"Alternative8","type":"object","representation":"raw","fields":[{"name":"target_object","displayName":"Target object","description":"A UUID or slug to identify the object that the referenced record belongs to.","type":"string","required":true,"example":"people"},{"name":"target_record_id","displayName":"Target record id","description":"A UUID to identify the referenced record.","type":"string","format":"uuid","required":true,"example":"891dcbfc-9141-415d-9b2a-2238a6cc012d"}]},{"name":"alternative9","displayName":"Alternative9","type":"object","example":{"matching_attribute_id_123":[{"value":"matching_attribute_id_123"}],"target_object":"people"},"representation":"raw","fields":[{"name":"[slug_or_id_of_matching_attribute]","displayName":"[slug or id of matching attribute]","description":"Reference a record by ID or one matching attribute. Set target_object, provide the matching attribute slug or ID, and pass one value in that attribute's expected format.","type":"array","required":true,"representation":"raw","items":{"name":"item","displayName":"Item","type":"alternative","composition":"anyOf","representation":"raw","alternatives":[{"name":"alternative1","displayName":"Alternative1","type":"object","representation":"raw","fields":[{"name":"domain","displayName":"Domain","description":"The full domain of the website.","type":"string","example":"app.attio.com"}]},{"name":"alternative2","displayName":"Alternative2","type":"object","representation":"raw","fields":[{"name":"email_address","displayName":"Email address","description":"An email address string","type":"string","example":"alice@app.attio.com"}]},{"name":"alternative3","displayName":"Alternative3","type":"object","representation":"raw","fields":[{"name":"value","displayName":"Value","description":"Numbers are persisted as 64 bit floats.","type":"number","example":17224912}]},{"name":"alternative4","displayName":"Alternative4","type":"object","representation":"raw","fields":[{"name":"country_code","displayName":"Country code","description":"The ISO 3166-1 alpha-2 country code representing the country that this phone number belongs to.","type":"string","enum":["AF","AX","AL","DZ","AS","AD","AO","AI","AQ","AG","AR","AM","AW","AU","AT","AZ","BS","BH","BD","BB","BY","BE","BZ","BJ","BM","BT","BO","BA","BW","BV","BR","IO","BN","BG","BF","BI","KH","CM","CA","CV","KY","CF","TD","CL","CN","CX","CC","CO","KM","CG","CD","CK","CR","CI","HR","CU","CW","CY","CZ","DK","DJ","DM","DO","EC","EG","SV","GQ","ER","EE","ET","FK","FO","FJ","FI","FR","GF","PF","TF","GA","GM","GE","DE","GH","GI","GR","GL","GD","GP","GU","GT","GG","GN","GW","GY","HT","HM","VA","HN","HK","HU","IS","IN","ID","IR","IQ","IE","IM","IL","IT","JM","JP","JE","JO","KZ","KE","KI","KR","KW","KG","LA","LV","LB","LS","LR","LY","LI","LT","LU","MO","MK","MG","MW","MY","MV","ML","MT","MH","MQ","MR","MU","YT","MX","FM","MD","MC","MN","ME","MS","MA","MZ","MM","NA","NR","NP","NL","AN","NC","NZ","NI","NE","NG","NU","NF","MP","NO","OM","PK","PW","PS","PA","PG","PY","PE","PH","PN","PL","PT","PR","QA","RE","RO","RU","RW","BL","SH","KN","LC","MF","PM","VC","WS","SM","ST","SA","SN","SS","RS","SC","SL","SG","SK","SI","SB","SO","ZA","GS","ES","LK","SD","SR","SJ","SZ","SE","CH","SY","TW","TJ","TZ","TH","TL","TG","TK","TO","TT","TN","TR","TM","TC","TV","UG","UA","AE","GB","US","UM","UY","UZ","VU","VE","VN","VG","VI","WF","EH","YE","ZM","ZW","BQ","KP","SX","XK","AC"],"example":"GB","nullable":true},{"name":"original_phone_number","displayName":"Original phone number","description":"The raw, original phone number, as inputted.","type":"string","example":"07234172834"}]},{"name":"alternative5","displayName":"Alternative5","type":"object","representation":"raw","fields":[{"name":"value","displayName":"Value","description":"A raw text field. Values are limited to 10MB.","type":"string"}]}]}},{"name":"target_object","displayName":"Target object","description":"A UUID or slug to identify the object that the referenced record belongs to.","type":"string","required":true,"example":"people"}]},{"name":"alternative10","displayName":"Alternative10","type":"object","representation":"raw","fields":[{"name":"interacted_at","displayName":"Interacted at","description":"When the interaction occurred.","type":"string","format":"date-time","required":true,"example":"2023-01-01T15:00:00.000000000Z"},{"name":"interaction_type","displayName":"Interaction type","description":"The type of interaction e.g. calendar or email.","type":"string","required":true,"enum":["activity","email","meeting","calendar-event"],"example":"email"},{"name":"owner_actor","displayName":"Owner actor","description":"The actor that created this value.","type":"object","required":true,"example":{"id":"50cf242c-7fa3-4cad-87d0-75b1af71c57b","type":"workspace-member"},"representation":"raw","fields":[{"name":"id","displayName":"Id","description":"An ID to identify the actor.","type":"string","nullable":true},{"name":"type","displayName":"Type","description":"The type of actor. [Read more information on actor types here](/docs/actors).","type":"string","enum":["api-token","workspace-member","system","app"],"nullable":true}]}]},{"name":"alternative11","displayName":"Alternative11","type":"object","representation":"raw","fields":[{"name":"country_code","displayName":"Country code","description":"The ISO 3166-1 alpha-2 country code for the country this location is in.","type":"string","required":true,"enum":["AF","AX","AL","DZ","AS","AD","AO","AI","AQ","AG","AR","AM","AW","AU","AT","AZ","BS","BH","BD","BB","BY","BE","BZ","BJ","BM","BT","BO","BA","BW","BV","BR","IO","BN","BG","BF","BI","KH","CM","CA","CV","KY","CF","TD","CL","CN","CX","CC","CO","KM","CG","CD","CK","CR","CI","HR","CU","CW","CY","CZ","DK","DJ","DM","DO","EC","EG","SV","GQ","ER","EE","ET","FK","FO","FJ","FI","FR","GF","PF","TF","GA","GM","GE","DE","GH","GI","GR","GL","GD","GP","GU","GT","GG","GN","GW","GY","HT","HM","VA","HN","HK","HU","IS","IN","ID","IR","IQ","IE","IM","IL","IT","JM","JP","JE","JO","KZ","KE","KI","KR","KW","KG","LA","LV","LB","LS","LR","LY","LI","LT","LU","MO","MK","MG","MW","MY","MV","ML","MT","MH","MQ","MR","MU","YT","MX","FM","MD","MC","MN","ME","MS","MA","MZ","MM","NA","NR","NP","NL","AN","NC","NZ","NI","NE","NG","NU","NF","MP","NO","OM","PK","PW","PS","PA","PG","PY","PE","PH","PN","PL","PT","PR","QA","RE","RO","RU","RW","BL","SH","KN","LC","MF","PM","VC","WS","SM","ST","SA","SN","SS","RS","SC","SL","SG","SK","SI","SB","SO","ZA","GS","ES","LK","SD","SR","SJ","SZ","SE","CH","SY","TW","TJ","TZ","TH","TL","TG","TK","TO","TT","TN","TR","TM","TC","TV","UG","UA","AE","GB","US","UM","UY","UZ","VU","VE","VN","VG","VI","WF","EH","YE","ZM","ZW","BQ","KP","SX","XK","AC"],"example":"US","nullable":true},{"name":"latitude","displayName":"Latitude","description":"The latitude of the location. Validated by the regular expression `/^[-+]?([1-8]?\\d(\\.\\d+)?|90(\\.0+)?)$/`. Values are stored with up to 9 decimal places of precision. Note that this value is not currently represented in the UI but will be persisted and readable through API calls.}","type":"string","required":true,"example":"37.331741","pattern":"^[-+]?([1-8]?\\d(\\.\\d+)?|90(\\.0+)?)$","nullable":true},{"name":"line_1","displayName":"Line 1","description":"The first line of the address. Note that this value is not currently represented in the UI but will be persisted and readable through API calls.","type":"string","required":true,"example":"1 Infinite Loop","nullable":true},{"name":"line_2","displayName":"Line 2","description":"The second line of the address. Note that this value is not currently represented in the UI but will be persisted and readable through API calls.","type":"string","required":true,"example":"Block 1","nullable":true},{"name":"line_3","displayName":"Line 3","description":"The third line of the address. Note that this value is not currently represented in the UI but will be persisted and readable through API calls.","type":"string","required":true,"example":"Hilldrop Estate","nullable":true},{"name":"line_4","displayName":"Line 4","description":"The fourth line of the address. Note that this value is not currently represented in the UI but will be persisted and readable through API calls.","type":"string","required":true,"example":"Westborough","nullable":true},{"name":"locality","displayName":"Locality","description":"The town, neighborhood or area the location is in.","type":"string","required":true,"example":"Cupertino","nullable":true},{"name":"longitude","displayName":"Longitude","description":"The longitude of the location. Validated by the regular expression `/^[-+]?(180(\\.0+)?|((1[0-7]\\d)|([1-9]?\\d))(\\.\\d+)?)$/`. Values are stored with up to 9 decimal places of precision. Note that this value is not currently represented in the UI but will be persisted and readable through API calls.}","type":"string","required":true,"example":"-122.030333","pattern":"^[-+]?(180(\\.0+)?|((1[0-7]\\d)|([1-9]?\\d))(\\.\\d+)?)$","nullable":true},{"name":"postcode","displayName":"Postcode","description":"The postcode or zip code for the location. Note that this value is not currently represented in the UI but will be persisted and readable through API calls.}","type":"string","required":true,"example":"95014","nullable":true},{"name":"region","displayName":"Region","description":"The state, county, province or region that the location is in.","type":"string","required":true,"example":"CA","nullable":true}]},{"name":"alternative12","displayName":"Alternative12","type":"object","representation":"raw","fields":[{"name":"value","displayName":"Value","description":"Numbers are persisted as 64 bit floats.","type":"number","required":true,"example":42}]},{"name":"alternative13","displayName":"Alternative13","type":"object","representation":"raw","fields":[{"name":"first_name","displayName":"First name","description":"The first name.","type":"string","example":"Ada"},{"name":"full_name","displayName":"Full name","description":"The full name.","type":"string","example":"Ada Lovelace"},{"name":"last_name","displayName":"Last name","description":"The last name.","type":"string","example":"Lovelace"}]},{"name":"alternative14","displayName":"Alternative14","type":"object","representation":"raw","fields":[{"name":"country_code","displayName":"Country code","description":"The ISO 3166-1 alpha-2 country code representing the country that this phone number belongs to. Optional if `original_phone_number` includes a country code prefix.","type":"string","enum":["AF","AX","AL","DZ","AS","AD","AO","AI","AQ","AG","AR","AM","AW","AU","AT","AZ","BS","BH","BD","BB","BY","BE","BZ","BJ","BM","BT","BO","BA","BW","BV","BR","IO","BN","BG","BF","BI","KH","CM","CA","CV","KY","CF","TD","CL","CN","CX","CC","CO","KM","CG","CD","CK","CR","CI","HR","CU","CW","CY","CZ","DK","DJ","DM","DO","EC","EG","SV","GQ","ER","EE","ET","FK","FO","FJ","FI","FR","GF","PF","TF","GA","GM","GE","DE","GH","GI","GR","GL","GD","GP","GU","GT","GG","GN","GW","GY","HT","HM","VA","HN","HK","HU","IS","IN","ID","IR","IQ","IE","IM","IL","IT","JM","JP","JE","JO","KZ","KE","KI","KR","KW","KG","LA","LV","LB","LS","LR","LY","LI","LT","LU","MO","MK","MG","MW","MY","MV","ML","MT","MH","MQ","MR","MU","YT","MX","FM","MD","MC","MN","ME","MS","MA","MZ","MM","NA","NR","NP","NL","AN","NC","NZ","NI","NE","NG","NU","NF","MP","NO","OM","PK","PW","PS","PA","PG","PY","PE","PH","PN","PL","PT","PR","QA","RE","RO","RU","RW","BL","SH","KN","LC","MF","PM","VC","WS","SM","ST","SA","SN","SS","RS","SC","SL","SG","SK","SI","SB","SO","ZA","GS","ES","LK","SD","SR","SJ","SZ","SE","CH","SY","TW","TJ","TZ","TH","TL","TG","TK","TO","TT","TN","TR","TM","TC","TV","UG","UA","AE","GB","US","UM","UY","UZ","VU","VE","VN","VG","VI","WF","EH","YE","ZM","ZW","BQ","KP","SX","XK","AC"],"example":"GB","nullable":true},{"name":"original_phone_number","displayName":"Original phone number","description":"A phone number which is either a) prefixed with a country code (e.g. `+44....`) or b) a local number, where `country_code` is specified in addition.","type":"string","required":true,"example":"+15558675309"}]},{"name":"alternative15","displayName":"Alternative15","type":"object","representation":"raw","fields":[{"name":"status","displayName":"Status","description":"The UUID or status title identifying the selected status.","type":"string","required":true,"example":"In Progress"}]},{"name":"alternative16","displayName":"Alternative16","type":"object","representation":"raw","fields":[{"name":"value","displayName":"Value","description":"A number between 0 and 5 (inclusive) to represent a star rating.","type":"number","required":true,"example":3}]},{"name":"alternative17","displayName":"Alternative17","type":"object","representation":"raw","fields":[{"name":"option","displayName":"Option","description":"The UUID or select option title identifying the selected select option.","type":"string","required":true,"example":"Medium"}]},{"name":"alternative18","displayName":"Alternative18","type":"object","representation":"raw","fields":[{"name":"value","displayName":"Value","description":"A raw text field. Values are limited to 10MB.","type":"string","required":true,"example":"Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."}]},{"name":"alternative19","displayName":"Alternative19","type":"object","representation":"raw","fields":[{"name":"value","displayName":"Value","description":"A timestamp is an ISO 8601 date-time. Missing timezone information defaults to UTC; returned timestamps are always in UTC. Attio may coerce partial dates or times to a complete timestamp.","type":"string","format":"date","required":true,"example":"2023-01-01T15:00:00.000000000Z"}]}]}},{"name":"type","displayName":"Type","type":"string","required":true,"enum":["static"],"example":"static"}]}]},{"name":"description","displayName":"Description","description":"A text description for the attribute.","type":"string","required":true,"example":"Lorem ipsum","nullable":true},{"name":"is_multiselect","displayName":"Is multiselect","description":"Whether or not this attribute can have multiple values. Multiselect is only available on some value types.","type":"boolean","required":true,"example":true},{"name":"is_required","displayName":"Is required","description":"When `is_required` is `true`, new records/entries must have a value for this attribute. If `false`, values may be `null`. This value does not affect existing data and you do not need to backfill `null` values if changing `is_required` from `false` to `true`.","type":"boolean","required":true,"example":true},{"name":"is_unique","displayName":"Is unique","description":"Whether or not new values for this attribute must be unique. Uniqueness restrictions are only applied to new data and do not apply retroactively to previously created data.","type":"boolean","required":true,"example":true},{"name":"relationship","displayName":"Relationship","description":"Optional relationship configuration. When provided, creates a bidirectional relationship between two objects. Can only be used with attributes of type \"record-reference\". If `config.record_reference.allowed_objects` is also provided, it must contain only the relationship object.","type":"object","representation":"raw","nullable":true,"fields":[{"name":"api_slug","displayName":"Api slug","description":"The API slug for the reverse relationship attribute.","type":"string","required":true,"example":"team_members"},{"name":"is_multiselect","displayName":"Is multiselect","description":"Whether the related attribute supports multiple values. Combined with the parent attribute's is_multiselect setting, this determines relationship cardinality.","type":"boolean","required":true,"example":false},{"name":"object","displayName":"Object","description":"The slug or UUID of the object to create the reverse relationship attribute on.","type":"string","required":true,"example":"companies"},{"name":"title","displayName":"Title","description":"The title for the reverse relationship attribute.","type":"string","required":true,"example":"Team members"}]},{"name":"title","displayName":"Title","description":"The name of the attribute. The title will be visible across Attio's UI.","type":"string","required":true,"example":"Your Attribute"},{"name":"type","displayName":"Type","description":"The type of the attribute. This value affects the possible `config` values.","type":"string","required":true,"enum":["text","number","checkbox","currency","date","timestamp","rating","status","select","record-reference","actor-reference","location","domain","email-address","phone-number"],"example":"text"}]}, this.getNodeParameter("data", itemIndex), this, itemIndex);
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
        errorPlan = {"400":{"title":"Bad Request"},"403":{"title":"Forbidden"},"404":{"title":"Not Found"},"409":{"title":"Conflict"}};
        break;
      }
    case "postV2TargetIdentifierAttributesAttributeOptions": {
        
        
        let path = "/v2/{target}/{identifier}/attributes/{attribute}/options";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{target}").join(encodeURIComponent(String(this.getNodeParameter("target", itemIndex))));
    path = path.split("{identifier}").join(encodeURIComponent(String(this.getNodeParameter("identifier", itemIndex))));
    path = path.split("{attribute}").join(encodeURIComponent(String(this.getNodeParameter("attribute", itemIndex))));
        setBodyField(body as IDataObject, {"name":"data","displayName":"Data","type":"object","required":true,"representation":"raw","fields":[{"name":"title","displayName":"Title","description":"The Title of the select option","type":"string","required":true,"example":"Medium"}]}, this.getNodeParameter("data", itemIndex), this, itemIndex);
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
        errorPlan = {"400":{"title":"Bad Request"},"403":{"title":"Forbidden"},"404":{"title":"Not Found"},"409":{"title":"Conflict"}};
        break;
      }
    case "postV2TargetIdentifierAttributesAttributeStatuses": {
        
        
        let path = "/v2/{target}/{identifier}/attributes/{attribute}/statuses";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{target}").join(encodeURIComponent(String(this.getNodeParameter("target", itemIndex))));
    path = path.split("{identifier}").join(encodeURIComponent(String(this.getNodeParameter("identifier", itemIndex))));
    path = path.split("{attribute}").join(encodeURIComponent(String(this.getNodeParameter("attribute", itemIndex))));
        setBodyField(body as IDataObject, {"name":"data","displayName":"Data","type":"object","required":true,"representation":"raw","fields":[{"name":"celebration_enabled","displayName":"Celebration enabled","description":"Whether arriving at this status triggers a celebration effect","type":"boolean","default":false,"example":true},{"name":"target_time_in_status","displayName":"Target time in status","description":"Target time for a record to spend in given status expressed as a ISO-8601 duration string","type":"string","example":"P0Y0M1DT0H0M0S","pattern":"P(?:(\\d+Y)?(\\d+M)?(\\d+W)?(\\d+D)?(?:T(\\d+(?:[\\.,]\\d+)?H)?(\\d+(?:[\\.,]\\d+)?M)?(\\d+(?:[\\.,]\\d+)?S)?)?)","nullable":true},{"name":"title","displayName":"Title","description":"The Title of the status","type":"string","required":true,"example":"In Progress"}]}, this.getNodeParameter("data", itemIndex), this, itemIndex);
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
        errorPlan = {"400":{"title":"Bad Request"},"403":{"title":"Forbidden"},"404":{"title":"Not Found"},"409":{"title":"Conflict"}};
        break;
      }
    case "deleteV2MeetingsMeetingIdCallRecordingsCallRecordingId": {
        
        
        let path = "/v2/meetings/{meeting_id}/call_recordings/{call_recording_id}";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{meeting_id}").join(encodeURIComponent(String(this.getNodeParameter("meeting_id", itemIndex))));
    path = path.split("{call_recording_id}").join(encodeURIComponent(String(this.getNodeParameter("call_recording_id", itemIndex))));
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "DELETE" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"404":{"title":"Call recording not found"}};
        break;
      }
    case "getV2MeetingsMeetingIdCallRecordings": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        let path = "/v2/meetings/{meeting_id}/call_recordings";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{meeting_id}").join(encodeURIComponent(String(this.getNodeParameter("meeting_id", itemIndex))));
    if (additionalFields["limit"] !== undefined) qs["limit"] = additionalFields["limit"];
    if (additionalFields["cursor"] !== undefined) qs["cursor"] = additionalFields["cursor"];
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","pagination"], simplified: ["data","pagination"] };
        errorPlan = {};
        break;
      }
    case "getV2MeetingsMeetingIdCallRecordingsCallRecordingId": {
        
        
        let path = "/v2/meetings/{meeting_id}/call_recordings/{call_recording_id}";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{meeting_id}").join(encodeURIComponent(String(this.getNodeParameter("meeting_id", itemIndex))));
    path = path.split("{call_recording_id}").join(encodeURIComponent(String(this.getNodeParameter("call_recording_id", itemIndex))));
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
        errorPlan = {"404":{"title":"Not Found"}};
        break;
      }
    case "postV2MeetingsMeetingIdCallRecordings": {
        
        
        let path = "/v2/meetings/{meeting_id}/call_recordings";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{meeting_id}").join(encodeURIComponent(String(this.getNodeParameter("meeting_id", itemIndex))));
        setBodyField(body as IDataObject, {"name":"data","displayName":"Data","type":"object","required":true,"representation":"raw","fields":[{"name":"transcript","displayName":"Transcript","description":"Transcript text for the call recording. It is optional for compatibility but should be supplied for summaries and transcript-derived features; it may become required in a future API version.","type":"array","representation":"raw","items":{"name":"item","displayName":"Item","type":"object","representation":"raw","fields":[{"name":"end_time","displayName":"End time","description":"The end time of this speech segment in seconds.","type":"number","required":true,"example":3.2123},{"name":"speaker","displayName":"Speaker","type":"object","required":true,"representation":"raw","fields":[{"name":"email_address","displayName":"Email address","description":"The email address of the speaker.","type":"string","format":"email","example":"person@company.com"},{"name":"name","displayName":"Name","description":"The name of the speaker.","type":"string","required":true,"example":"Simon Mitchell"}]},{"name":"speech","displayName":"Speech","description":"The spoken text for this segment of the transcript.","type":"string","required":true,"example":"Hello everyone, welcome to the meeting."},{"name":"start_time","displayName":"Start time","description":"The start time of this speech segment in seconds.","type":"number","required":true,"minValue":0,"example":0.5123}]}},{"name":"video_url","displayName":"Video url","description":"Public HTTPS URL for an MP4 call recording, up to 1 GB. Attio downloads it asynchronously and checks the URL with a HEAD request. A transcript can be submitted without a video.","type":"string","format":"uri","example":"https://example.com/recording.mp4"}]}, this.getNodeParameter("data", itemIndex), this, itemIndex);
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
        errorPlan = {"400":{"title":"Bad Request"},"403":{"title":"Forbidden"},"404":{"title":"Not Found"}};
        break;
      }
    case "deleteV2CommentsCommentId": {
        
        
        let path = "/v2/comments/{comment_id}";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{comment_id}").join(encodeURIComponent(String(this.getNodeParameter("comment_id", itemIndex))));
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "DELETE" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"403":{"title":"Forbidden"},"404":{"title":"Not Found"}};
        break;
      }
    case "getV2CommentsCommentId": {
        
        
        let path = "/v2/comments/{comment_id}";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{comment_id}").join(encodeURIComponent(String(this.getNodeParameter("comment_id", itemIndex))));
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
        errorPlan = {"404":{"title":"Not Found"}};
        break;
      }
    case "postV2Comments": {
        
        
        const path = "/v2/comments";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        setBodyField(body as IDataObject, {"name":"data","displayName":"Data","type":"alternative","required":true,"composition":"anyOf","representation":"raw","alternatives":[{"name":"alternative1","displayName":"Alternative1","type":"object","representation":"raw","fields":[{"name":"author","displayName":"Author","description":"The workspace member who wrote this comment. Note that other types of actors are not currently supported.","type":"object","required":true,"example":{"id":"50cf242c-7fa3-4cad-87d0-75b1af71c57b","type":"workspace-member"},"representation":"raw","fields":[{"name":"id","displayName":"Id","type":"string","format":"uuid","required":true},{"name":"type","displayName":"Type","type":"string","required":true,"enum":["workspace-member"]}]},{"name":"content","displayName":"Content","description":"The content of the comment itself. Workspace members can be mentioned using their email address, otherwise email addresses will be presented to users as clickable mailto links.","type":"string","required":true,"example":"If I put the email address of my colleague on Attio in here, e.g. alice@attio.com, they will be notified. Other emails (e.g. person@example.com) will be turned into clickable links."},{"name":"created_at","displayName":"Created at","description":"`created_at` will default to the current time. However, if you wish to backdate a comment for migration or other purposes, you can override with a custom `created_at` value. Note that dates before 1970 or in the future are not allowed.","type":"string","example":"2023-01-01T15:00:00.000000000Z"},{"name":"format","displayName":"Format","description":"The format that the comment content is provided in. The `plaintext` format uses the line feed character `\\n` to create new lines within the note content. Rich text formatting and links are not supported.","type":"string","required":true,"enum":["plaintext"]},{"name":"thread_id","displayName":"Thread id","description":"If responding to an existing thread, this would be the ID of that thread.","type":"string","format":"uuid","required":true,"example":"aa1dc1d9-93ac-4c6c-987e-16b6eea9aab2"}]},{"name":"alternative2","displayName":"Alternative2","type":"object","representation":"raw","fields":[{"name":"author","displayName":"Author","description":"The workspace member who wrote this comment. Note that other types of actors are not currently supported.","type":"object","required":true,"example":{"id":"50cf242c-7fa3-4cad-87d0-75b1af71c57b","type":"workspace-member"},"representation":"raw","fields":[{"name":"id","displayName":"Id","type":"string","format":"uuid","required":true},{"name":"type","displayName":"Type","type":"string","required":true,"enum":["workspace-member"]}]},{"name":"content","displayName":"Content","description":"The content of the comment itself. Workspace members can be mentioned using their email address, otherwise email addresses will be presented to users as clickable mailto links.","type":"string","required":true,"example":"If I put the email address of my colleague on Attio in here, e.g. alice@attio.com, they will be notified. Other emails (e.g. person@example.com) will be turned into clickable links."},{"name":"created_at","displayName":"Created at","description":"`created_at` will default to the current time. However, if you wish to backdate a comment for migration or other purposes, you can override with a custom `created_at` value. Note that dates before 1970 or in the future are not allowed.","type":"string","example":"2023-01-01T15:00:00.000000000Z"},{"name":"format","displayName":"Format","description":"The format that the comment content is provided in. The `plaintext` format uses the line feed character `\\n` to create new lines within the note content. Rich text formatting and links are not supported.","type":"string","required":true,"enum":["plaintext"]},{"name":"record","displayName":"Record","type":"object","required":true,"representation":"raw","fields":[{"name":"object","displayName":"Object","description":"If creating a top-level comment on a record, this is the slug or ID of that object.","type":"string","required":true,"example":"97052eb9-e65e-443f-a297-f2d9a4a7f795"},{"name":"record_id","displayName":"Record id","description":"If creating a top-level comment on a record, this is the ID of that record.","type":"string","format":"uuid","required":true,"example":"bf071e1f-6035-429d-b874-d83ea64ea13b"}]}]},{"name":"alternative3","displayName":"Alternative3","type":"object","representation":"raw","fields":[{"name":"author","displayName":"Author","description":"The workspace member who wrote this comment. Note that other types of actors are not currently supported.","type":"object","required":true,"example":{"id":"50cf242c-7fa3-4cad-87d0-75b1af71c57b","type":"workspace-member"},"representation":"raw","fields":[{"name":"id","displayName":"Id","type":"string","format":"uuid","required":true},{"name":"type","displayName":"Type","type":"string","required":true,"enum":["workspace-member"]}]},{"name":"content","displayName":"Content","description":"The content of the comment itself. Workspace members can be mentioned using their email address, otherwise email addresses will be presented to users as clickable mailto links.","type":"string","required":true,"example":"If I put the email address of my colleague on Attio in here, e.g. alice@attio.com, they will be notified. Other emails (e.g. person@example.com) will be turned into clickable links."},{"name":"created_at","displayName":"Created at","description":"`created_at` will default to the current time. However, if you wish to backdate a comment for migration or other purposes, you can override with a custom `created_at` value. Note that dates before 1970 or in the future are not allowed.","type":"string","example":"2023-01-01T15:00:00.000000000Z"},{"name":"entry","displayName":"Entry","type":"object","required":true,"representation":"raw","fields":[{"name":"entry_id","displayName":"Entry id","description":"If creating a top-level comment on a list entry, this is the ID of that entry.","type":"string","required":true,"example":"2e6e29ea-c4e0-4f44-842d-78a891f8c156"},{"name":"list","displayName":"List","description":"If creating a top-level comment on a list entry, this is the slug or ID of that list.","type":"string","required":true,"example":"33ebdbe9-e529-47c9-b894-0ba25e9c15c0"}]},{"name":"format","displayName":"Format","description":"The format that the comment content is provided in. The `plaintext` format uses the line feed character `\\n` to create new lines within the note content. Rich text formatting and links are not supported.","type":"string","required":true,"enum":["plaintext"]}]}]}, this.getNodeParameter("data", itemIndex), this, itemIndex);
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
        errorPlan = {"400":{"title":"Bad Request"}};
        break;
      }
    case "getV2Emails": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/v2/emails";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        if (additionalFields["limit"] !== undefined) qs["limit"] = additionalFields["limit"];
    if (additionalFields["cursor"] !== undefined) qs["cursor"] = additionalFields["cursor"];
    if (additionalFields["linked_object"] !== undefined) qs["linked_object"] = additionalFields["linked_object"];
    if (additionalFields["linked_record_ids"] !== undefined) qs["linked_record_ids"] = additionalFields["linked_record_ids"];
    if (additionalFields["participants"] !== undefined) qs["participants"] = additionalFields["participants"];
    if (additionalFields["domain"] !== undefined) qs["domain"] = additionalFields["domain"];
    if (additionalFields["sent_after"] !== undefined) qs["sent_after"] = additionalFields["sent_after"];
    if (additionalFields["sent_before"] !== undefined) qs["sent_before"] = additionalFields["sent_before"];
    if (additionalFields["exclude_automated_participants"] !== undefined) qs["exclude_automated_participants"] = additionalFields["exclude_automated_participants"];
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","pagination"], simplified: ["data","pagination"] };
        errorPlan = {};
        break;
      }
    case "deleteV2ListsListEntriesEntryId": {
        
        
        let path = "/v2/lists/{list}/entries/{entry_id}";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{list}").join(encodeURIComponent(String(this.getNodeParameter("list", itemIndex))));
    path = path.split("{entry_id}").join(encodeURIComponent(String(this.getNodeParameter("entry_id", itemIndex))));
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "DELETE" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"403":{"title":"Forbidden"},"404":{"title":"Not Found"}};
        break;
      }
    case "getV2ListsListEntriesEntryId": {
        
        
        let path = "/v2/lists/{list}/entries/{entry_id}";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{list}").join(encodeURIComponent(String(this.getNodeParameter("list", itemIndex))));
    path = path.split("{entry_id}").join(encodeURIComponent(String(this.getNodeParameter("entry_id", itemIndex))));
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
        errorPlan = {"404":{"title":"Not Found"}};
        break;
      }
    case "getV2ListsListEntriesEntryIdAttributesAttributeValues": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        let path = "/v2/lists/{list}/entries/{entry_id}/attributes/{attribute}/values";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{list}").join(encodeURIComponent(String(this.getNodeParameter("list", itemIndex))));
    path = path.split("{entry_id}").join(encodeURIComponent(String(this.getNodeParameter("entry_id", itemIndex))));
    path = path.split("{attribute}").join(encodeURIComponent(String(this.getNodeParameter("attribute", itemIndex))));
    if (additionalFields["show_historic"] !== undefined) qs["show_historic"] = additionalFields["show_historic"];
    if (additionalFields["limit"] !== undefined) qs["limit"] = additionalFields["limit"];
    if (additionalFields["offset"] !== undefined) qs["offset"] = additionalFields["offset"];
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
        errorPlan = {"404":{"title":"Not Found"}};
        break;
      }
    case "patchV2ListsListEntriesEntryId": {
        
        
        let path = "/v2/lists/{list}/entries/{entry_id}";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{list}").join(encodeURIComponent(String(this.getNodeParameter("list", itemIndex))));
    path = path.split("{entry_id}").join(encodeURIComponent(String(this.getNodeParameter("entry_id", itemIndex))));
        setBodyField(body as IDataObject, {"name":"data","displayName":"Data","type":"object","required":true,"representation":"raw","fields":[{"name":"entry_values","displayName":"Entry values","description":"Attribute values keyed by api_slug or attribute_id. Pass one value for single-select attributes or an array for multi-select values; see Attio's attribute type documentation for value formats.","type":"object","required":true,"example":{"41252299-f8c7-4b5e-99c9-4ff8321d2f96":"Text value","multiselect_attribute":["Select option 1","Select option 2"]},"representation":"raw","additionalValue":{"name":"value","displayName":"Value","type":"array","representation":"raw"}}]}, this.getNodeParameter("data", itemIndex), this, itemIndex);
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "PATCH" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
        errorPlan = {"400":{"title":"Bad Request"},"403":{"title":"Forbidden"},"404":{"title":"Not Found"}};
        break;
      }
    case "postV2ListsListEntries": {
        
        
        let path = "/v2/lists/{list}/entries";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{list}").join(encodeURIComponent(String(this.getNodeParameter("list", itemIndex))));
        setBodyField(body as IDataObject, {"name":"data","displayName":"Data","type":"object","required":true,"representation":"raw","fields":[{"name":"entry_values","displayName":"Entry values","description":"Attribute values keyed by api_slug or attribute_id. Pass one value for single-select attributes or an array for multi-select values; see Attio's attribute type documentation for value formats.","type":"object","required":true,"example":{"41252299-f8c7-4b5e-99c9-4ff8321d2f96":"Text value","multiselect_attribute":["Select option 1","Select option 2"]},"representation":"raw","additionalValue":{"name":"value","displayName":"Value","type":"array","representation":"raw"}},{"name":"parent_object","displayName":"Parent object","description":"A UUID or slug identifying the object that the added parent record belongs to.","type":"string","required":true,"example":"people"},{"name":"parent_record_id","displayName":"Parent record id","description":"A UUID identifying the record you want to add to the list. The record will become the 'parent' of the created list entry.","type":"string","format":"uuid","required":true,"example":"891dcbfc-9141-415d-9b2a-2238a6cc012d"}]}, this.getNodeParameter("data", itemIndex), this, itemIndex);
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
        errorPlan = {"400":{"title":"Bad Request"},"403":{"title":"Forbidden"},"404":{"title":"Not Found"}};
        break;
      }
    case "postV2ListsListEntriesQuery": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        let path = "/v2/lists/{list}/entries/query";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{list}").join(encodeURIComponent(String(this.getNodeParameter("list", itemIndex))));
        if (additionalFields["filter"] !== undefined) setBodyField(body as IDataObject, {"name":"filter","displayName":"Filter","description":"An object used to filter results to a subset of results. Cannot be used together with `filter_view_id`. See the [full guide to filtering and sorting here](/rest-api/guides/filtering-and-sorting).","type":"object","example":{"name":"Ada Lovelace"},"representation":"raw","additionalValue":{"name":"value","displayName":"Value","type":"any"}}, additionalFields["filter"], this, itemIndex);
    if (additionalFields["filter_view_id"] !== undefined) setBodyField(body as IDataObject, {"name":"filter_view_id","displayName":"Filter view id","description":"UUID of a saved view to apply. It cannot be combined with filter; sorting, limits, and offsets remain independent, and all attributes are returned.","type":"string","format":"uuid"}, additionalFields["filter_view_id"], this, itemIndex);
    if (additionalFields["limit"] !== undefined) setBodyField(body as IDataObject, {"name":"limit","displayName":"Limit","description":"The maximum number of results to return. Defaults to 500. See the [full guide to pagination here](/rest-api/guides/pagination).","type":"number","example":500}, additionalFields["limit"], this, itemIndex);
    if (additionalFields["offset"] !== undefined) setBodyField(body as IDataObject, {"name":"offset","displayName":"Offset","description":"The number of results to skip over before returning. Defaults to 0. See the [full guide to pagination here](/rest-api/guides/pagination).","type":"number","example":0}, additionalFields["offset"], this, itemIndex);
    if (additionalFields["sorts"] !== undefined) setBodyField(body as IDataObject, {"name":"sorts","displayName":"Sorts","description":"An object used to sort results. See the [full guide to filtering and sorting here](/rest-api/guides/filtering-and-sorting).","type":"array","example":[{"attribute":"name","direction":"asc","field":"last_name"}],"representation":"raw","items":{"name":"item","displayName":"Item","description":"Sort by attribute","type":"alternative","composition":"anyOf","representation":"raw","alternatives":[{"name":"alternative1","displayName":"Alternative1","description":"Sort by attribute","type":"object","representation":"raw","fields":[{"name":"attribute","displayName":"Attribute","description":"A slug or ID to identify the attribute to sort by.","type":"string","required":true},{"name":"direction","displayName":"Direction","description":"The direction to sort the results by.","type":"string","required":true,"enum":["asc","desc"]},{"name":"field","displayName":"Field","description":"Which field on the value to sort by e.g. \"last_name\" on a name value.","type":"string"}]},{"name":"alternative2","displayName":"Alternative2","description":"Sort by path","type":"object","representation":"raw","fields":[{"name":"direction","displayName":"Direction","description":"The direction to sort the results by.","type":"string","required":true,"enum":["asc","desc"]},{"name":"field","displayName":"Field","description":"Which field on the value to sort by e.g. \"last_name\" on a name value.","type":"string"},{"name":"path","displayName":"Path","description":"Use path to traverse record-reference attributes and list-entry parent records. Each tuple contains a list or object ID followed by an attribute ID; the first tuple starts at the queried list or object.","type":"array","required":true,"representation":"raw","items":{"name":"item","displayName":"Item","type":"array","representation":"raw","items":{"name":"item","displayName":"Item","description":"The slug or ID of the object e.g. \"people\".","type":"alternative","composition":"anyOf","representation":"raw","alternatives":[{"name":"alternative1","displayName":"Alternative1","description":"The slug or ID of the object e.g. \"people\".","type":"string"},{"name":"alternative2","displayName":"Alternative2","description":"A slug or ID to identify the attribute to sort by.","type":"string"}]}}}]}]}}, additionalFields["sorts"], this, itemIndex);
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
        errorPlan = {"404":{"title":"Not Found"}};
        break;
      }
    case "putV2ListsListEntries": {
        
        
        let path = "/v2/lists/{list}/entries";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{list}").join(encodeURIComponent(String(this.getNodeParameter("list", itemIndex))));
        setBodyField(body as IDataObject, {"name":"data","displayName":"Data","type":"object","required":true,"representation":"raw","fields":[{"name":"entry_values","displayName":"Entry values","description":"Attribute values keyed by api_slug or attribute_id. Pass one value for single-select attributes or an array for multi-select values; see Attio's attribute type documentation for value formats.","type":"object","required":true,"example":{"41252299-f8c7-4b5e-99c9-4ff8321d2f96":"Text value","multiselect_attribute":["Select option 1","Select option 2"]},"representation":"raw","additionalValue":{"name":"value","displayName":"Value","type":"array","representation":"raw"}},{"name":"parent_object","displayName":"Parent object","description":"A UUID or slug identifying the object that the added parent record belongs to.","type":"string","required":true,"example":"people"},{"name":"parent_record_id","displayName":"Parent record id","description":"A UUID identifying the record you want to add to the list. The record will become the 'parent' of the created list entry.","type":"string","format":"uuid","required":true,"example":"891dcbfc-9141-415d-9b2a-2238a6cc012d"}]}, this.getNodeParameter("data", itemIndex), this, itemIndex);
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "PUT" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
        errorPlan = {"400":{"title":"Bad Request"},"403":{"title":"Forbidden"},"404":{"title":"Not Found"}};
        break;
      }
    case "putV2ListsListEntriesEntryId": {
        
        
        let path = "/v2/lists/{list}/entries/{entry_id}";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{list}").join(encodeURIComponent(String(this.getNodeParameter("list", itemIndex))));
    path = path.split("{entry_id}").join(encodeURIComponent(String(this.getNodeParameter("entry_id", itemIndex))));
        setBodyField(body as IDataObject, {"name":"data","displayName":"Data","type":"object","required":true,"representation":"raw","fields":[{"name":"entry_values","displayName":"Entry values","description":"Attribute values keyed by api_slug or attribute_id. Pass one value for single-select attributes or an array for multi-select values; see Attio's attribute type documentation for value formats.","type":"object","required":true,"example":{"41252299-f8c7-4b5e-99c9-4ff8321d2f96":"Text value","multiselect_attribute":["Select option 1","Select option 2"]},"representation":"raw","additionalValue":{"name":"value","displayName":"Value","type":"array","representation":"raw"}}]}, this.getNodeParameter("data", itemIndex), this, itemIndex);
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "PUT" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
        errorPlan = {"400":{"title":"Bad Request"},"403":{"title":"Forbidden"},"404":{"title":"Not Found"}};
        break;
      }
    case "putV2ListsListEntriesEntryIdAttributesAttributeValues": {
        
        
        let path = "/v2/lists/{list}/entries/{entry_id}/attributes/{attribute}/values";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{list}").join(encodeURIComponent(String(this.getNodeParameter("list", itemIndex))));
    path = path.split("{entry_id}").join(encodeURIComponent(String(this.getNodeParameter("entry_id", itemIndex))));
    path = path.split("{attribute}").join(encodeURIComponent(String(this.getNodeParameter("attribute", itemIndex))));
        setBodyField(body as IDataObject, {"name":"data","displayName":"Data","type":"object","required":true,"representation":"raw","fields":[{"name":"replace_history","displayName":"Replace history","description":"Must be `true`. Acknowledges that this request replaces the attribute's entire value history, destroying every value it currently has, including values not present in this request.","type":"boolean","required":true,"enum":[true]},{"name":"values","displayName":"Values","description":"The complete value history to write, replacing any existing values. Values may be supplied in any order. Gaps between intervals are allowed. At least one value is required, and a maximum of 400 values may be written in one request.","type":"array","required":true,"representation":"raw","items":{"name":"item","displayName":"Item","type":"object","representation":"raw","fields":[{"name":"active_from","displayName":"Active from","description":"An RFC 3339 timestamp for when this value became active. May not be in the future.","type":"string","format":"date-time","required":true},{"name":"active_until","displayName":"Active until","description":"An RFC 3339 timestamp for when this value stopped being active, or `null` if it is still active. Must be after `active_from` and may not be in the future. This key is required: omitting it is almost always a mistake in a migration.","type":"string","format":"date-time","required":true,"nullable":true},{"name":"value","displayName":"Value","description":"The value itself, in the same form accepted when updating a record or list entry. For complete documentation on values for all attribute types, please see our [attribute type docs](/docs/attribute-types).","type":"alternative","required":true,"composition":"anyOf","representation":"raw","alternatives":[{"name":"alternative1","displayName":"Alternative1","type":"object","representation":"raw","additionalValue":{"name":"value","displayName":"Value","type":"string"}},{"name":"alternative2","displayName":"Alternative2","type":"string"},{"name":"alternative3","displayName":"Alternative3","type":"number"},{"name":"alternative4","displayName":"Alternative4","type":"boolean"}]}]}}]}, this.getNodeParameter("data", itemIndex), this, itemIndex);
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "PUT" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
        errorPlan = {"400":{"title":"Bad Request"},"403":{"title":"Forbidden"},"404":{"title":"Not Found"}};
        break;
      }
    case "deleteV2FilesFileId": {
        
        
        let path = "/v2/files/{file_id}";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{file_id}").join(encodeURIComponent(String(this.getNodeParameter("file_id", itemIndex))));
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "DELETE" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"404":{"title":"Not Found"}};
        break;
      }
    case "getV2Files": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/v2/files";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        qs["object"] = this.getNodeParameter("object", itemIndex);
    qs["record_id"] = this.getNodeParameter("record_id", itemIndex);
    if (additionalFields["storage_provider"] !== undefined) qs["storage_provider"] = additionalFields["storage_provider"];
    if (additionalFields["parent_folder_id"] !== undefined) qs["parent_folder_id"] = additionalFields["parent_folder_id"];
    if (additionalFields["limit"] !== undefined) qs["limit"] = additionalFields["limit"];
    if (additionalFields["cursor"] !== undefined) qs["cursor"] = additionalFields["cursor"];
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","pagination"], simplified: ["data","pagination"] };
        errorPlan = {};
        break;
      }
    case "getV2FilesFileId": {
        
        
        let path = "/v2/files/{file_id}";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{file_id}").join(encodeURIComponent(String(this.getNodeParameter("file_id", itemIndex))));
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
        errorPlan = {"404":{"title":"Not Found"}};
        break;
      }
    case "getV2FilesFileIdDownload": {
        
        
        let path = "/v2/files/{file_id}/download";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{file_id}").join(encodeURIComponent(String(this.getNodeParameter("file_id", itemIndex))));
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"302":{"title":"Redirect"}};
        break;
      }
    case "postV2Files": {
        
        
        const path = "/v2/files";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        let body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        body = normalizeJsonValue(this.getNodeParameter("bodyJson", itemIndex), "Body JSON", this, itemIndex) as typeof body; validateBodyValue(body, {"name":"bodyJson","displayName":"Body JSON","type":"any","required":true,"description":"Raw request body","alternatives":[{"name":"alternative1","displayName":"Alternative1","type":"object","fields":[{"name":"file_type","displayName":"File type","type":"string","required":true,"description":"Creates a native Attio folder entry.","enum":["folder"]},{"name":"name","displayName":"Name","type":"string","required":true,"description":"The folder name.","example":"Documents"},{"name":"object","displayName":"Object","type":"string","required":true,"description":"The object slug or ID.","example":"people"},{"name":"parent_folder_id","displayName":"Parent folder id","type":"string","format":"uuid","description":"Optional parent folder ID. Omit to create a top-level folder.","example":"a1b2c3d4-e5f6-7890-abcd-ef1234567890"},{"name":"record_id","displayName":"Record id","type":"string","format":"uuid","required":true,"description":"The ID of the record to create the file entry on.","example":"bf071e1f-6035-429d-b874-d83ea64ea13b"}],"representation":"raw"},{"name":"alternative2","displayName":"Alternative2","type":"object","fields":[{"name":"external_provider_file_id","displayName":"External provider file id","type":"string","required":true,"description":"The ID of the file or folder in the external storage provider.","example":"01ISGXZ5BRAMVD7SEPXNCYS4XGKT3YTOKQ"},{"name":"file_type","displayName":"File type","type":"string","required":true,"description":"Creates a connected folder entry.","enum":["connected-folder"]},{"name":"microsoft_drive_id","displayName":"Microsoft drive id","type":"string","description":"Microsoft drive ID. Only used when `storage_provider` is `microsoft-onedrive`.","example":"b!-RIj2DuyvEyV1T4NlOaMHk8XkS_I8MdFlUCq1BlcjgmhRfAj3-Z8RY2VpuvV_tpd","nullable":true},{"name":"object","displayName":"Object","type":"string","required":true,"description":"The object slug or ID.","example":"people"},{"name":"record_id","displayName":"Record id","type":"string","format":"uuid","required":true,"description":"The ID of the record to create the file entry on.","example":"bf071e1f-6035-429d-b874-d83ea64ea13b"},{"name":"storage_provider","displayName":"Storage provider","type":"string","required":true,"description":"The external storage provider.","enum":["dropbox","box","google-drive","microsoft-onedrive"],"example":"google-drive"}],"representation":"raw"},{"name":"alternative3","displayName":"Alternative3","type":"object","fields":[{"name":"external_provider_file_id","displayName":"External provider file id","type":"string","required":true,"description":"The ID of the file or folder in the external storage provider.","example":"01ISGXZ5BRAMVD7SEPXNCYS4XGKT3YTOKQ"},{"name":"file_type","displayName":"File type","type":"string","required":true,"description":"Creates a connected file entry.","enum":["connected-file"]},{"name":"microsoft_drive_id","displayName":"Microsoft drive id","type":"string","description":"Microsoft drive ID. Only used when `storage_provider` is `microsoft-onedrive`.","example":"b!-RIj2DuyvEyV1T4NlOaMHk8XkS_I8MdFlUCq1BlcjgmhRfAj3-Z8RY2VpuvV_tpd","nullable":true},{"name":"object","displayName":"Object","type":"string","required":true,"description":"The object slug or ID.","example":"people"},{"name":"record_id","displayName":"Record id","type":"string","format":"uuid","required":true,"description":"The ID of the record to create the file entry on.","example":"bf071e1f-6035-429d-b874-d83ea64ea13b"},{"name":"storage_provider","displayName":"Storage provider","type":"string","required":true,"description":"The external storage provider.","enum":["dropbox","box","google-drive","microsoft-onedrive"],"example":"google-drive"}],"representation":"raw"}],"composition":"oneOf","representation":"raw"}, "Body JSON", this, itemIndex);
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
        errorPlan = {};
        break;
      }
    case "postV2FilesUpload": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/v2/files/upload";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        setBodyField(body as IDataObject, {"name":"file","displayName":"File","description":"The file to upload.","type":"string","format":"binary","required":true}, this.getNodeParameter("file", itemIndex), this, itemIndex);
    setBodyField(body as IDataObject, {"name":"object","displayName":"Object","description":"The object slug or ID.","type":"string","required":true,"example":"people"}, this.getNodeParameter("object", itemIndex), this, itemIndex);
    if (additionalFields["parent_folder_id"] !== undefined) setBodyField(body as IDataObject, {"name":"parent_folder_id","displayName":"Parent folder id","description":"Optional parent folder ID. Omit to upload to the root folder.","type":"string","format":"uuid","example":"a1b2c3d4-e5f6-7890-abcd-ef1234567890"}, additionalFields["parent_folder_id"], this, itemIndex);
    setBodyField(body as IDataObject, {"name":"record_id","displayName":"Record id","description":"The ID of the record to upload the file to.","type":"string","format":"uuid","required":true,"example":"bf071e1f-6035-429d-b874-d83ea64ea13b"}, this.getNodeParameter("record_id", itemIndex), this, itemIndex);
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: toFormData(body), json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
        errorPlan = {"403":{"title":"Forbidden"}};
        break;
      }
    case "getV2Lists": {
        
        
        const path = "/v2/lists";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
        errorPlan = {};
        break;
      }
    case "getV2ListsList": {
        
        
        let path = "/v2/lists/{list}";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{list}").join(encodeURIComponent(String(this.getNodeParameter("list", itemIndex))));
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
        errorPlan = {"404":{"title":"Not Found"}};
        break;
      }
    case "getV2ListsListViews": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        let path = "/v2/lists/{list}/views";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{list}").join(encodeURIComponent(String(this.getNodeParameter("list", itemIndex))));
    if (additionalFields["show_archived"] !== undefined) qs["show_archived"] = additionalFields["show_archived"];
    if (additionalFields["limit"] !== undefined) qs["limit"] = additionalFields["limit"];
    if (additionalFields["cursor"] !== undefined) qs["cursor"] = additionalFields["cursor"];
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","pagination"], simplified: ["data","pagination"] };
        errorPlan = {"404":{"title":"Not Found"}};
        break;
      }
    case "patchV2ListsList": {
        
        
        let path = "/v2/lists/{list}";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{list}").join(encodeURIComponent(String(this.getNodeParameter("list", itemIndex))));
        setBodyField(body as IDataObject, {"name":"data","displayName":"Data","type":"object","required":true,"representation":"raw","fields":[{"name":"api_slug","displayName":"Api slug","description":"A unique, human-readable slug to access the list through API calls. Should be formatted in snake case.","type":"string","example":"enterprise_sales"},{"name":"name","displayName":"Name","description":"The human-readable name of the list.","type":"string","example":"Enterprise Sales"},{"name":"workspace_access","displayName":"Workspace access","description":"The level of access granted to all members of the workspace for this list. Pass `null` to keep the list private and only grant access to specific workspace members.","type":"string","enum":["full-access","read-and-write","read-only"],"example":"read-and-write","nullable":true},{"name":"workspace_member_access","displayName":"Workspace member access","description":"The level of access granted to specific workspace members for this list. Pass an empty array to grant access to no workspace members.","type":"array","representation":"raw","items":{"name":"item","displayName":"Item","type":"object","representation":"raw","fields":[{"name":"level","displayName":"Level","description":"The level of access to the list.","type":"string","required":true,"enum":["full-access","read-and-write","read-only"],"example":"read-and-write"},{"name":"workspace_member_id","displayName":"Workspace member id","description":"A UUID to identify the workspace member to grant access to.","type":"string","format":"uuid","required":true,"example":"50cf242c-7fa3-4cad-87d0-75b1af71c57b"}]}}]}, this.getNodeParameter("data", itemIndex), this, itemIndex);
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "PATCH" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
        errorPlan = {"400":{"title":"Bad Request"},"404":{"title":"Not Found"}};
        break;
      }
    case "postV2Lists": {
        
        
        const path = "/v2/lists";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        setBodyField(body as IDataObject, {"name":"data","displayName":"Data","type":"object","required":true,"representation":"raw","fields":[{"name":"api_slug","displayName":"Api slug","description":"A unique, human-readable slug to access the list through API calls. Should be formatted in snake case.","type":"string","required":true,"example":"enterprise_sales"},{"name":"name","displayName":"Name","description":"The human-readable name of the list.","type":"string","required":true,"example":"Enterprise Sales"},{"name":"parent_object","displayName":"Parent object","description":"A UUID or slug to identify the allowed object type for records added to this list.","type":"string","required":true,"example":"people"},{"name":"workspace_access","displayName":"Workspace access","description":"The level of access granted to all members of the workspace for this list. Pass `null` to keep the list private and only grant access to specific workspace members.","type":"string","required":true,"enum":["full-access","read-and-write","read-only"],"example":"read-and-write","nullable":true},{"name":"workspace_member_access","displayName":"Workspace member access","description":"The level of access granted to specific workspace members for this list. Pass an empty array to grant access to no workspace members.","type":"array","required":true,"representation":"raw","items":{"name":"item","displayName":"Item","type":"object","representation":"raw","fields":[{"name":"level","displayName":"Level","description":"The level of access to the list.","type":"string","required":true,"enum":["full-access","read-and-write","read-only"],"example":"read-and-write"},{"name":"workspace_member_id","displayName":"Workspace member id","description":"A UUID to identify the workspace member to grant access to.","type":"string","format":"uuid","required":true,"example":"50cf242c-7fa3-4cad-87d0-75b1af71c57b"}]}}]}, this.getNodeParameter("data", itemIndex), this, itemIndex);
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
        errorPlan = {"400":{"title":"Bad Request"},"403":{"title":"Forbidden"},"404":{"title":"Not Found"},"409":{"title":"Conflict"}};
        break;
      }
    case "deleteV2MeetingsMeetingId": {
        
        
        let path = "/v2/meetings/{meeting_id}";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{meeting_id}").join(encodeURIComponent(String(this.getNodeParameter("meeting_id", itemIndex))));
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "DELETE" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Bad Request"},"404":{"title":"Not Found"}};
        break;
      }
    case "getV2Meetings": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/v2/meetings";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        if (additionalFields["limit"] !== undefined) qs["limit"] = additionalFields["limit"];
    if (additionalFields["cursor"] !== undefined) qs["cursor"] = additionalFields["cursor"];
    if (additionalFields["linked_object"] !== undefined) qs["linked_object"] = additionalFields["linked_object"];
    if (additionalFields["linked_record_id"] !== undefined) qs["linked_record_id"] = additionalFields["linked_record_id"];
    if (additionalFields["participants"] !== undefined) qs["participants"] = additionalFields["participants"];
    if (additionalFields["sort"] !== undefined) qs["sort"] = additionalFields["sort"];
    if (additionalFields["ends_from"] !== undefined) qs["ends_from"] = additionalFields["ends_from"];
    if (additionalFields["starts_before"] !== undefined) qs["starts_before"] = additionalFields["starts_before"];
    if (additionalFields["timezone"] !== undefined) qs["timezone"] = additionalFields["timezone"];
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","pagination"], simplified: ["data","pagination"] };
        errorPlan = {};
        break;
      }
    case "getV2MeetingsMeetingId": {
        
        
        let path = "/v2/meetings/{meeting_id}";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{meeting_id}").join(encodeURIComponent(String(this.getNodeParameter("meeting_id", itemIndex))));
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
        errorPlan = {"404":{"title":"Not Found"}};
        break;
      }
    case "patchV2MeetingsMeetingId": {
        
        
        let path = "/v2/meetings/{meeting_id}";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{meeting_id}").join(encodeURIComponent(String(this.getNodeParameter("meeting_id", itemIndex))));
        setBodyField(body as IDataObject, {"name":"data","displayName":"Data","type":"object","required":true,"representation":"raw","fields":[{"name":"linked_records","displayName":"Linked records","type":"array","required":true,"representation":"raw","items":{"name":"item","displayName":"Item","type":"object","representation":"raw","fields":[{"name":"object","displayName":"Object","description":"The slug or UUID of the object that the record being linked belongs to.","type":"string","required":true,"example":"people"},{"name":"record_id","displayName":"Record id","description":"The UUID of the record being linked.","type":"string","format":"uuid","required":true,"example":"891dcbfc-9141-415d-9b2a-2238a6cc012d"}]}}]}, this.getNodeParameter("data", itemIndex), this, itemIndex);
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "PATCH" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
        errorPlan = {"400":{"title":"Bad Request"},"404":{"title":"Not Found"}};
        break;
      }
    case "postV2Meetings": {
        
        
        const path = "/v2/meetings";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        setBodyField(body as IDataObject, {"name":"data","displayName":"Data","type":"object","required":true,"representation":"raw","fields":[{"name":"description","displayName":"Description","description":"The description of the meeting.","type":"string","required":true,"example":"Getting you up to speed with the platform and answering any questions you have."},{"name":"end","displayName":"End","description":"When the meeting ends. Use a datetime and optional timezone for non-all day meetings, or a date for all day meetings.","type":"alternative","required":true,"composition":"anyOf","representation":"raw","alternatives":[{"name":"alternative1","displayName":"Alternative1","type":"object","representation":"raw","fields":[{"name":"datetime","displayName":"Datetime","description":"An ISO 8601 datetime indicating when a non-all day meeting ends. Note that this value is exclusive, meaning that the meeting ends before the specified time, not at it. For example, a one hour meeting starting at 14:00 would end at 15:00, not 15:59:59.","type":"string","format":"date-time","required":true,"example":"2027-11-27T15:00:00Z"},{"name":"timezone","displayName":"Timezone","description":"IANA timezone used to interpret an end datetime without an offset. Explicit offsets are not adjusted again; invalid timezones default to UTC.","type":"string","example":"America/New_York","nullable":true}]},{"name":"alternative2","displayName":"Alternative2","type":"object","representation":"raw","fields":[{"name":"date","displayName":"Date","description":"An ISO 8601 date indicating when an all day meeting ends. Note that dates are exclusive, meaning that the meeting ends before the specified time, not at it. For example, a one day meeting on June 3rd would end on June 4th, not June 3rd.","type":"string","required":true,"example":"2027-11-28"}]}]},{"name":"is_all_day","displayName":"Is all day","description":"Whether or not the meeting is an all day event. All day events may span multiple days. When true, start and end must use date format. When false, start and end must use datetime with timezone format.","type":"boolean","required":true,"example":false},{"name":"linked_records","displayName":"Linked records","description":"A list of records to link to the meeting. Each record is specified by its object (slug or UUID) and record ID (UUID). Attio will automatically link the meeting participants' companies to the meeting; this behavior is asynchronous.","type":"array","representation":"raw","items":{"name":"item","displayName":"Item","type":"object","representation":"raw","fields":[{"name":"object","displayName":"Object","description":"The slug or UUID of the object that the record being linked belongs to.","type":"string","required":true,"example":"people"},{"name":"record_id","displayName":"Record id","description":"The UUID of the record being linked.","type":"string","format":"uuid","required":true,"example":"891dcbfc-9141-415d-9b2a-2238a6cc012d"}]}},{"name":"participants","displayName":"Participants","type":"array","required":true,"representation":"raw","items":{"name":"item","displayName":"Item","type":"object","representation":"raw","fields":[{"name":"email_address","displayName":"Email address","description":"The email address of the participant. New person records and companies will automatically be created based upon the email address values provided. If omitted, a name must be provided instead.","type":"string","example":"person@company.com"},{"name":"is_organizer","displayName":"Is organizer","description":"Whether or not the participant is the organizer of the meeting.","type":"alternative","required":true,"example":true,"composition":"anyOf","representation":"raw","alternatives":[{"name":"alternative1","displayName":"Alternative1","type":"boolean"},{"name":"alternative2","displayName":"Alternative2","type":"string","enum":["true"]},{"name":"alternative3","displayName":"Alternative3","type":"string","enum":["false"]}]},{"name":"name","displayName":"Name","description":"The name of the participant. Required when no email_address is provided. Participants without an email do not create person or company records.","type":"string","example":"Simon Mitchell"},{"name":"status","displayName":"Status","description":"The status of the individual meeting participant.","type":"string","required":true,"enum":["accepted","tentative","declined","pending"],"example":"accepted"}]}},{"name":"start","displayName":"Start","description":"When the meeting starts. Use a datetime and optional timezone for non-all day meetings, or a date for all day meetings.","type":"alternative","required":true,"composition":"anyOf","representation":"raw","alternatives":[{"name":"alternative1","displayName":"Alternative1","type":"object","representation":"raw","fields":[{"name":"datetime","displayName":"Datetime","description":"An ISO 8601 datetime indicating when a non-all day meeting starts.","type":"string","format":"date-time","required":true,"example":"2027-11-27T14:00:00Z"},{"name":"timezone","displayName":"Timezone","description":"IANA timezone used to interpret a start datetime without an offset. Explicit offsets are not adjusted again; invalid timezones default to UTC.","type":"string","example":"America/New_York","nullable":true}]},{"name":"alternative2","displayName":"Alternative2","type":"object","representation":"raw","fields":[{"name":"date","displayName":"Date","description":"An ISO 8601 date indicating when an all day meeting starts.","type":"string","required":true,"example":"2027-11-27"}]}]},{"name":"title","displayName":"Title","description":"The title of the meeting.","type":"string","required":true,"example":"Onboarding Session"}]}, this.getNodeParameter("data", itemIndex), this, itemIndex);
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
        errorPlan = {"400":{"title":"Bad Request"}};
        break;
      }
    case "putV2MeetingsMeetingId": {
        
        
        let path = "/v2/meetings/{meeting_id}";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{meeting_id}").join(encodeURIComponent(String(this.getNodeParameter("meeting_id", itemIndex))));
        setBodyField(body as IDataObject, {"name":"data","displayName":"Data","type":"object","required":true,"representation":"raw","fields":[{"name":"linked_records","displayName":"Linked records","type":"array","required":true,"representation":"raw","items":{"name":"item","displayName":"Item","type":"object","representation":"raw","fields":[{"name":"object","displayName":"Object","description":"The slug or UUID of the object that the record being linked belongs to.","type":"string","required":true,"example":"people"},{"name":"record_id","displayName":"Record id","description":"The UUID of the record being linked.","type":"string","format":"uuid","required":true,"example":"891dcbfc-9141-415d-9b2a-2238a6cc012d"}]}}]}, this.getNodeParameter("data", itemIndex), this, itemIndex);
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "PUT" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
        errorPlan = {"400":{"title":"Bad Request"},"404":{"title":"Not Found"}};
        break;
      }
    case "getV2Self": {
        
        
        const path = "/v2/self";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {};
        break;
      }
    case "deleteV2NotesNoteId": {
        
        
        let path = "/v2/notes/{note_id}";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{note_id}").join(encodeURIComponent(String(this.getNodeParameter("note_id", itemIndex))));
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "DELETE" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"404":{"title":"Not Found"}};
        break;
      }
    case "getV2Notes": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/v2/notes";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        if (additionalFields["limit"] !== undefined) qs["limit"] = additionalFields["limit"];
    if (additionalFields["offset"] !== undefined) qs["offset"] = additionalFields["offset"];
    if (additionalFields["parent_object"] !== undefined) qs["parent_object"] = additionalFields["parent_object"];
    if (additionalFields["parent_record_id"] !== undefined) qs["parent_record_id"] = additionalFields["parent_record_id"];
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
        errorPlan = {"404":{"title":"Not Found"}};
        break;
      }
    case "getV2NotesNoteId": {
        
        
        let path = "/v2/notes/{note_id}";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{note_id}").join(encodeURIComponent(String(this.getNodeParameter("note_id", itemIndex))));
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
        errorPlan = {"404":{"title":"Not Found"}};
        break;
      }
    case "patchV2NotesNoteId": {
        
        
        let path = "/v2/notes/{note_id}";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{note_id}").join(encodeURIComponent(String(this.getNodeParameter("note_id", itemIndex))));
        setBodyField(body as IDataObject, {"name":"data","displayName":"Data","type":"object","required":true,"representation":"raw","fields":[{"name":"content","displayName":"Content","description":"The main content of the note, formatted according to the value provided in the `format` field. Use `\\n` for line breaks in `plaintext`. For `markdown`, utilize the supported syntax elements to structure and style your note.","type":"string","example":"# Meeting Recap: Q4 Planning\n\n**Date:** 2023-10-26\n**Attendees:** Alex, Jamie, Casey\n\n## Key Discussion Points\n\n- Reviewed Q3 performance metrics.\n- Brainstormed key initiatives for Q4.\n- Discussed budget allocation for ==Project Phoenix==.\n\n## Action Items\n\n1. Alex to finalize Q4 roadmap by EOD Friday.\n2. Jamie to schedule follow-up with [Marketing Team](https://app.attio.com/teams/marketing).\n3. Casey to draft initial budget for ~~Project Chimera~~ (now deferred).\n\n*Next steps: Review draft roadmap next week.*"},{"name":"format","displayName":"Format","description":"Choose plaintext or markdown for note content. Markdown supports headings (levels 1–3), lists, bold, italic, strikethrough, highlights, and links.","type":"string","enum":["plaintext","markdown"],"example":"markdown"},{"name":"title","displayName":"Title","description":"The note title. The title is plaintext only and has no formatting.","type":"string","example":"Initial Prospecting Call Summary"}]}, this.getNodeParameter("data", itemIndex), this, itemIndex);
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "PATCH" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
        errorPlan = {"404":{"title":"Not Found"},"413":{"title":"Content Too Large"}};
        break;
      }
    case "postV2Notes": {
        
        
        const path = "/v2/notes";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        setBodyField(body as IDataObject, {"name":"data","displayName":"Data","type":"object","required":true,"representation":"raw","fields":[{"name":"content","displayName":"Content","description":"The main content of the note, formatted according to the value provided in the `format` field. Use `\\n` for line breaks in `plaintext`. For `markdown`, utilize the supported syntax elements to structure and style your note.","type":"string","required":true,"example":"# Meeting Recap: Q4 Planning\n\n**Date:** 2023-10-26\n**Attendees:** Alex, Jamie, Casey\n\n## Key Discussion Points\n\n- Reviewed Q3 performance metrics.\n- Brainstormed key initiatives for Q4.\n- Discussed budget allocation for ==Project Phoenix==.\n\n## Action Items\n\n1. Alex to finalize Q4 roadmap by EOD Friday.\n2. Jamie to schedule follow-up with [Marketing Team](https://app.attio.com/teams/marketing).\n3. Casey to draft initial budget for ~~Project Chimera~~ (now deferred).\n\n*Next steps: Review draft roadmap next week.*"},{"name":"created_at","displayName":"Created at","description":"`created_at` will default to the current time. However, if you wish to backdate a note for migration or other purposes, you can override with a custom `created_at` value. Note that dates before 1970 or in the future are not allowed.","type":"string","example":"2023-01-01T15:00:00.000000000Z"},{"name":"format","displayName":"Format","description":"Choose plaintext or markdown for note content. Markdown supports headings (levels 1–3), lists, bold, italic, strikethrough, highlights, and links.","type":"string","required":true,"enum":["plaintext","markdown"],"example":"markdown"},{"name":"meeting_id","displayName":"Meeting id","description":"An optional ID to associate this note with a meeting. If provided, the meeting must exist. Use `null` to explicitly set no meeting association.","type":"string","format":"uuid","example":"14beef7a-99f7-4534-a87e-70b564330a4c","nullable":true},{"name":"parent_object","displayName":"Parent object","description":"The ID or slug of the parent object the note belongs to.","type":"string","required":true,"example":"people"},{"name":"parent_record_id","displayName":"Parent record id","description":"The ID of the parent record the note belongs to.","type":"string","format":"uuid","required":true,"example":"891dcbfc-9141-415d-9b2a-2238a6cc012d"},{"name":"title","displayName":"Title","description":"The note title. The title is plaintext only and has no formatting.","type":"string","required":true,"example":"Initial Prospecting Call Summary"}]}, this.getNodeParameter("data", itemIndex), this, itemIndex);
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
        errorPlan = {"404":{"title":"Not Found"},"413":{"title":"Content Too Large"}};
        break;
      }
    case "deleteV2ObjectsObject": {
        
        
        let path = "/v2/objects/{object}";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{object}").join(encodeURIComponent(String(this.getNodeParameter("object", itemIndex))));
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "DELETE" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Bad Request"},"403":{"title":"Forbidden"},"404":{"title":"Not Found"}};
        break;
      }
    case "getV2Objects": {
        
        
        const path = "/v2/objects";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
        errorPlan = {};
        break;
      }
    case "getV2ObjectsObject": {
        
        
        let path = "/v2/objects/{object}";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{object}").join(encodeURIComponent(String(this.getNodeParameter("object", itemIndex))));
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
        errorPlan = {"404":{"title":"Not Found"}};
        break;
      }
    case "getV2ObjectsObjectViews": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        let path = "/v2/objects/{object}/views";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{object}").join(encodeURIComponent(String(this.getNodeParameter("object", itemIndex))));
    if (additionalFields["show_archived"] !== undefined) qs["show_archived"] = additionalFields["show_archived"];
    if (additionalFields["limit"] !== undefined) qs["limit"] = additionalFields["limit"];
    if (additionalFields["cursor"] !== undefined) qs["cursor"] = additionalFields["cursor"];
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","pagination"], simplified: ["data","pagination"] };
        errorPlan = {"404":{"title":"Not Found"}};
        break;
      }
    case "patchV2ObjectsObject": {
        
        
        let path = "/v2/objects/{object}";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{object}").join(encodeURIComponent(String(this.getNodeParameter("object", itemIndex))));
        setBodyField(body as IDataObject, {"name":"data","displayName":"Data","type":"object","required":true,"representation":"raw","fields":[{"name":"api_slug","displayName":"Api slug","description":"A unique, human-readable slug to access the object through URLs and API calls. Should be formatted in snake case.","type":"string","example":"people"},{"name":"plural_noun","displayName":"Plural noun","description":"The plural form of the object's name.","type":"string","example":"People"},{"name":"singular_noun","displayName":"Singular noun","description":"The singular form of the object's name.","type":"string","example":"Person"}]}, this.getNodeParameter("data", itemIndex), this, itemIndex);
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "PATCH" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
        errorPlan = {"400":{"title":"Bad Request"},"403":{"title":"Forbidden"},"404":{"title":"Not Found"},"409":{"title":"Conflict"}};
        break;
      }
    case "postV2Objects": {
        
        
        const path = "/v2/objects";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        setBodyField(body as IDataObject, {"name":"data","displayName":"Data","type":"object","required":true,"representation":"raw","fields":[{"name":"api_slug","displayName":"Api slug","description":"A unique, human-readable slug to access the object through URLs and API calls. Should be formatted in snake case.","type":"string","required":true,"example":"people"},{"name":"plural_noun","displayName":"Plural noun","description":"The plural form of the object's name.","type":"string","required":true,"example":"People"},{"name":"singular_noun","displayName":"Singular noun","description":"The singular form of the object's name.","type":"string","required":true,"example":"Person"}]}, this.getNodeParameter("data", itemIndex), this, itemIndex);
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
        errorPlan = {"400":{"title":"Bad Request"},"403":{"title":"Forbidden"},"409":{"title":"Conflict"}};
        break;
      }
    case "deleteV2ObjectsObjectRecordsRecordId": {
        
        
        let path = "/v2/objects/{object}/records/{record_id}";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{object}").join(encodeURIComponent(String(this.getNodeParameter("object", itemIndex))));
    path = path.split("{record_id}").join(encodeURIComponent(String(this.getNodeParameter("record_id", itemIndex))));
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "DELETE" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"403":{"title":"Forbidden"},"404":{"title":"Not Found"}};
        break;
      }
    case "getV2ObjectsObjectRecordsRecordId": {
        
        
        let path = "/v2/objects/{object}/records/{record_id}";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{object}").join(encodeURIComponent(String(this.getNodeParameter("object", itemIndex))));
    path = path.split("{record_id}").join(encodeURIComponent(String(this.getNodeParameter("record_id", itemIndex))));
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
        errorPlan = {"404":{"title":"Not Found"}};
        break;
      }
    case "getV2ObjectsObjectRecordsRecordIdAttributesAttributeValues": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        let path = "/v2/objects/{object}/records/{record_id}/attributes/{attribute}/values";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{object}").join(encodeURIComponent(String(this.getNodeParameter("object", itemIndex))));
    path = path.split("{record_id}").join(encodeURIComponent(String(this.getNodeParameter("record_id", itemIndex))));
    path = path.split("{attribute}").join(encodeURIComponent(String(this.getNodeParameter("attribute", itemIndex))));
    if (additionalFields["show_historic"] !== undefined) qs["show_historic"] = additionalFields["show_historic"];
    if (additionalFields["limit"] !== undefined) qs["limit"] = additionalFields["limit"];
    if (additionalFields["offset"] !== undefined) qs["offset"] = additionalFields["offset"];
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
        errorPlan = {"400":{"title":"Bad Request"},"404":{"title":"Not Found"}};
        break;
      }
    case "getV2ObjectsObjectRecordsRecordIdEntries": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        let path = "/v2/objects/{object}/records/{record_id}/entries";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{object}").join(encodeURIComponent(String(this.getNodeParameter("object", itemIndex))));
    path = path.split("{record_id}").join(encodeURIComponent(String(this.getNodeParameter("record_id", itemIndex))));
    if (additionalFields["limit"] !== undefined) qs["limit"] = additionalFields["limit"];
    if (additionalFields["offset"] !== undefined) qs["offset"] = additionalFields["offset"];
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
        errorPlan = {};
        break;
      }
    case "patchV2ObjectsObjectRecordsRecordId": {
        
        
        let path = "/v2/objects/{object}/records/{record_id}";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{object}").join(encodeURIComponent(String(this.getNodeParameter("object", itemIndex))));
    path = path.split("{record_id}").join(encodeURIComponent(String(this.getNodeParameter("record_id", itemIndex))));
        setBodyField(body as IDataObject, {"name":"data","displayName":"Data","type":"object","required":true,"representation":"raw","fields":[{"name":"values","displayName":"Values","description":"Attribute values keyed by api_slug or attribute_id. Pass one value for single-select attributes or an array for multi-select values; see Attio's attribute type documentation for value formats.","type":"object","required":true,"example":{"41252299-f8c7-4b5e-99c9-4ff8321d2f96":"Text value","multiselect_attribute":["Select option 1","Select option 2"]},"representation":"raw","additionalValue":{"name":"value","displayName":"Value","type":"array","representation":"raw"}}]}, this.getNodeParameter("data", itemIndex), this, itemIndex);
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "PATCH" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
        errorPlan = {"400":{"title":"Bad Request"},"403":{"title":"Forbidden"},"404":{"title":"Not Found"},"409":{"title":"Conflict"}};
        break;
      }
    case "postV2ObjectsObjectRecords": {
        
        
        let path = "/v2/objects/{object}/records";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{object}").join(encodeURIComponent(String(this.getNodeParameter("object", itemIndex))));
        setBodyField(body as IDataObject, {"name":"data","displayName":"Data","type":"object","required":true,"representation":"raw","fields":[{"name":"values","displayName":"Values","description":"Attribute values keyed by api_slug or attribute_id. Pass one value for single-select attributes or an array for multi-select values; see Attio's attribute type documentation for value formats.","type":"object","required":true,"example":{"41252299-f8c7-4b5e-99c9-4ff8321d2f96":"Text value","multiselect_attribute":["Select option 1","Select option 2"]},"representation":"raw","additionalValue":{"name":"value","displayName":"Value","type":"array","representation":"raw"}}]}, this.getNodeParameter("data", itemIndex), this, itemIndex);
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
        errorPlan = {"400":{"title":"Bad Request"},"403":{"title":"Forbidden"},"404":{"title":"Not Found"},"409":{"title":"Conflict"}};
        break;
      }
    case "postV2ObjectsObjectRecordsMerge": {
        
        
        let path = "/v2/objects/{object}/records/merge";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{object}").join(encodeURIComponent(String(this.getNodeParameter("object", itemIndex))));
        setBodyField(body as IDataObject, {"name":"data","displayName":"Data","type":"object","required":true,"representation":"raw","fields":[{"name":"primary_record_id","displayName":"Primary record id","description":"The ID of the record to keep values from. Where both records have a value for the same attribute, the primary record's value takes precedence.","type":"string","format":"uuid","required":true,"example":"891dcbfc-9141-415d-9b2a-2238a6cc012d"},{"name":"secondary_record_id","displayName":"Secondary record id","description":"The ID of the record to merge into the primary record. Its values are only kept where the primary record has no value for that attribute.","type":"string","format":"uuid","required":true,"example":"bf071e1f-6035-429d-b874-d83ea64ea13b"}]}, this.getNodeParameter("data", itemIndex), this, itemIndex);
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
        errorPlan = {"400":{"title":"Bad Request"},"403":{"title":"Forbidden"},"404":{"title":"Not Found"}};
        break;
      }
    case "postV2ObjectsObjectRecordsQuery": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        let path = "/v2/objects/{object}/records/query";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{object}").join(encodeURIComponent(String(this.getNodeParameter("object", itemIndex))));
        if (additionalFields["filter"] !== undefined) setBodyField(body as IDataObject, {"name":"filter","displayName":"Filter","description":"An object used to filter results to a subset of results. Cannot be used together with `filter_view_id`. See the [full guide to filtering and sorting here](/rest-api/guides/filtering-and-sorting).","type":"object","example":{"name":"Ada Lovelace"},"representation":"raw","additionalValue":{"name":"value","displayName":"Value","type":"any"}}, additionalFields["filter"], this, itemIndex);
    if (additionalFields["filter_view_id"] !== undefined) setBodyField(body as IDataObject, {"name":"filter_view_id","displayName":"Filter view id","description":"UUID of a saved view to apply. It cannot be combined with filter; sorting, limits, and offsets remain independent, and all attributes are returned.","type":"string","format":"uuid"}, additionalFields["filter_view_id"], this, itemIndex);
    if (additionalFields["limit"] !== undefined) setBodyField(body as IDataObject, {"name":"limit","displayName":"Limit","description":"The maximum number of results to return. Defaults to 500. See the [full guide to pagination here](/rest-api/guides/pagination).","type":"number","example":500}, additionalFields["limit"], this, itemIndex);
    if (additionalFields["offset"] !== undefined) setBodyField(body as IDataObject, {"name":"offset","displayName":"Offset","description":"The number of results to skip over before returning. Defaults to 0. See the [full guide to pagination here](/rest-api/guides/pagination).","type":"number","example":0}, additionalFields["offset"], this, itemIndex);
    if (additionalFields["sorts"] !== undefined) setBodyField(body as IDataObject, {"name":"sorts","displayName":"Sorts","description":"An object used to sort results. See the [full guide to filtering and sorting here](/rest-api/guides/filtering-and-sorting).","type":"array","example":[{"attribute":"name","direction":"asc","field":"last_name"}],"representation":"raw","items":{"name":"item","displayName":"Item","description":"Sort by attribute","type":"alternative","composition":"anyOf","representation":"raw","alternatives":[{"name":"alternative1","displayName":"Alternative1","description":"Sort by attribute","type":"object","representation":"raw","fields":[{"name":"attribute","displayName":"Attribute","description":"A slug or ID to identify the attribute to sort by.","type":"string","required":true},{"name":"direction","displayName":"Direction","description":"The direction to sort the results by.","type":"string","required":true,"enum":["asc","desc"]},{"name":"field","displayName":"Field","description":"Which field on the value to sort by e.g. \"last_name\" on a name value.","type":"string"}]},{"name":"alternative2","displayName":"Alternative2","description":"Sort by path","type":"object","representation":"raw","fields":[{"name":"direction","displayName":"Direction","description":"The direction to sort the results by.","type":"string","required":true,"enum":["asc","desc"]},{"name":"field","displayName":"Field","description":"Which field on the value to sort by e.g. \"last_name\" on a name value.","type":"string"},{"name":"path","displayName":"Path","description":"Use path to traverse record-reference attributes and list-entry parent records. Each tuple contains a list or object ID followed by an attribute ID; the first tuple starts at the queried list or object.","type":"array","required":true,"representation":"raw","items":{"name":"item","displayName":"Item","type":"array","representation":"raw","items":{"name":"item","displayName":"Item","description":"The slug or ID of the object e.g. \"people\".","type":"alternative","composition":"anyOf","representation":"raw","alternatives":[{"name":"alternative1","displayName":"Alternative1","description":"The slug or ID of the object e.g. \"people\".","type":"string"},{"name":"alternative2","displayName":"Alternative2","description":"A slug or ID to identify the attribute to sort by.","type":"string"}]}}}]}]}}, additionalFields["sorts"], this, itemIndex);
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
        errorPlan = {"400":{"title":"Bad Request"},"404":{"title":"Not Found"}};
        break;
      }
    case "postV2ObjectsRecordsSearch": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/v2/objects/records/search";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        if (additionalFields["limit"] !== undefined) setBodyField(body as IDataObject, {"name":"limit","displayName":"Limit","description":"The maximum number of results to return. Defaults to 25.","type":"number","minValue":1,"maxValue":25,"default":25,"example":25}, additionalFields["limit"], this, itemIndex);
    setBodyField(body as IDataObject, {"name":"objects","displayName":"Objects","description":"Specifies which objects to filter results by. At least one object must be specified. Accepts object slugs or IDs.","type":"array","required":true,"example":["people","deals","1b31b79a-ddf9-4d57-a320-884061b2bcff"],"representation":"raw","items":{"name":"item","displayName":"Item","description":"The object slug or UUID that you would like to filter by.","type":"string","example":"people"}}, this.getNodeParameter("objects", itemIndex), this, itemIndex);
    setBodyField(body as IDataObject, {"name":"query","displayName":"Query","description":"Query string to search for. An empty string returns a default set of results.","type":"string","required":true,"example":"alan mathis"}, this.getNodeParameter("query", itemIndex), this, itemIndex);
    setBodyField(body as IDataObject, {"name":"request_as","displayName":"Request as","description":"Specifies the context in which to perform the search. Use 'workspace' to return all search results or specify a workspace member to limit results to what one specific person in your workspace can see.","type":"alternative","required":true,"composition":"anyOf","representation":"raw","alternatives":[{"name":"alternative1","displayName":"Alternative1","type":"object","representation":"raw","fields":[{"name":"type","displayName":"Type","type":"string","required":true,"enum":["workspace"]}]},{"name":"alternative2","displayName":"Alternative2","type":"object","representation":"raw","fields":[{"name":"type","displayName":"Type","type":"string","required":true,"enum":["workspace-member"]},{"name":"workspace_member_id","displayName":"Workspace member id","type":"string","format":"uuid","required":true,"example":"50cf242c-7fa3-4cad-87d0-75b1af71c57b"}]},{"name":"alternative3","displayName":"Alternative3","type":"object","representation":"raw","fields":[{"name":"email_address","displayName":"Email address","type":"string","format":"email","required":true,"example":"alice@attio.com"},{"name":"type","displayName":"Type","type":"string","required":true,"enum":["workspace-member"]}]}]}, this.getNodeParameter("request_as", itemIndex), this, itemIndex);
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
        errorPlan = {"400":{"title":"Bad Request"}};
        break;
      }
    case "putV2ObjectsObjectRecords": {
        
        
        let path = "/v2/objects/{object}/records";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{object}").join(encodeURIComponent(String(this.getNodeParameter("object", itemIndex))));
    qs["matching_attribute"] = this.getNodeParameter("matching_attribute", itemIndex);
        setBodyField(body as IDataObject, {"name":"data","displayName":"Data","type":"object","required":true,"representation":"raw","fields":[{"name":"values","displayName":"Values","description":"Attribute values keyed by api_slug or attribute_id. Pass one value for single-select attributes or an array for multi-select values; see Attio's attribute type documentation for value formats.","type":"object","required":true,"example":{"41252299-f8c7-4b5e-99c9-4ff8321d2f96":"Text value","multiselect_attribute":["Select option 1","Select option 2"]},"representation":"raw","additionalValue":{"name":"value","displayName":"Value","type":"array","representation":"raw"}}]}, this.getNodeParameter("data", itemIndex), this, itemIndex);
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "PUT" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
        errorPlan = {"400":{"title":"Bad Request"},"403":{"title":"Forbidden"},"404":{"title":"Not Found"},"409":{"title":"Conflict"}};
        break;
      }
    case "putV2ObjectsObjectRecordsRecordId": {
        
        
        let path = "/v2/objects/{object}/records/{record_id}";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{object}").join(encodeURIComponent(String(this.getNodeParameter("object", itemIndex))));
    path = path.split("{record_id}").join(encodeURIComponent(String(this.getNodeParameter("record_id", itemIndex))));
        setBodyField(body as IDataObject, {"name":"data","displayName":"Data","type":"object","required":true,"representation":"raw","fields":[{"name":"values","displayName":"Values","description":"Attribute values keyed by api_slug or attribute_id. Pass one value for single-select attributes or an array for multi-select values; see Attio's attribute type documentation for value formats.","type":"object","required":true,"example":{"41252299-f8c7-4b5e-99c9-4ff8321d2f96":"Text value","multiselect_attribute":["Select option 1","Select option 2"]},"representation":"raw","additionalValue":{"name":"value","displayName":"Value","type":"array","representation":"raw"}}]}, this.getNodeParameter("data", itemIndex), this, itemIndex);
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "PUT" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
        errorPlan = {"400":{"title":"Bad Request"},"403":{"title":"Forbidden"},"404":{"title":"Not Found"},"409":{"title":"Conflict"}};
        break;
      }
    case "putV2ObjectsObjectRecordsRecordIdAttributesAttributeValues": {
        
        
        let path = "/v2/objects/{object}/records/{record_id}/attributes/{attribute}/values";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{object}").join(encodeURIComponent(String(this.getNodeParameter("object", itemIndex))));
    path = path.split("{record_id}").join(encodeURIComponent(String(this.getNodeParameter("record_id", itemIndex))));
    path = path.split("{attribute}").join(encodeURIComponent(String(this.getNodeParameter("attribute", itemIndex))));
        setBodyField(body as IDataObject, {"name":"data","displayName":"Data","type":"object","required":true,"representation":"raw","fields":[{"name":"replace_history","displayName":"Replace history","description":"Must be `true`. Acknowledges that this request replaces the attribute's entire value history, destroying every value it currently has, including values not present in this request.","type":"boolean","required":true,"enum":[true]},{"name":"values","displayName":"Values","description":"The complete value history to write, replacing any existing values. Values may be supplied in any order. Gaps between intervals are allowed. At least one value is required, and a maximum of 400 values may be written in one request.","type":"array","required":true,"representation":"raw","items":{"name":"item","displayName":"Item","type":"object","representation":"raw","fields":[{"name":"active_from","displayName":"Active from","description":"An RFC 3339 timestamp for when this value became active. May not be in the future.","type":"string","format":"date-time","required":true},{"name":"active_until","displayName":"Active until","description":"An RFC 3339 timestamp for when this value stopped being active, or `null` if it is still active. Must be after `active_from` and may not be in the future. This key is required: omitting it is almost always a mistake in a migration.","type":"string","format":"date-time","required":true,"nullable":true},{"name":"value","displayName":"Value","description":"The value itself, in the same form accepted when updating a record or list entry. For complete documentation on values for all attribute types, please see our [attribute type docs](/docs/attribute-types).","type":"alternative","required":true,"composition":"anyOf","representation":"raw","alternatives":[{"name":"alternative1","displayName":"Alternative1","type":"object","representation":"raw","additionalValue":{"name":"value","displayName":"Value","type":"string"}},{"name":"alternative2","displayName":"Alternative2","type":"string"},{"name":"alternative3","displayName":"Alternative3","type":"number"},{"name":"alternative4","displayName":"Alternative4","type":"boolean"}]}]}}]}, this.getNodeParameter("data", itemIndex), this, itemIndex);
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "PUT" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
        errorPlan = {"400":{"title":"Bad Request"},"403":{"title":"Forbidden"},"404":{"title":"Not Found"}};
        break;
      }
    case "postV2SequencesUnsubscribedEmails": {
        
        
        const path = "/v2/sequences/unsubscribed_emails";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        setBodyField(body as IDataObject, {"name":"data","displayName":"Data","type":"object","required":true,"representation":"raw","fields":[{"name":"email_addresses","displayName":"Email addresses","description":"The email addresses to add to the unsubscribe list. A maximum of 1000 email addresses can be provided per request. Email addresses are normalized before they are stored.","type":"array","required":true,"representation":"raw","items":{"name":"item","displayName":"Item","type":"string","format":"email","example":"person@example.com"}}]}, this.getNodeParameter("data", itemIndex), this, itemIndex);
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
        errorPlan = {"400":{"title":"Bad Request"}};
        break;
      }
    case "postV2Sql": {
        
        
        const path = "/v2/sql";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        setBodyField(body as IDataObject, {"name":"sql","displayName":"Sql","description":"The SQL query to be executed.","type":"string","required":true,"example":"SELECT * FROM companies WHERE companies.name = 'Fundstack'"}, this.getNodeParameter("sql", itemIndex), this, itemIndex);
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
        errorPlan = {"400":{"title":"Bad Request"}};
        break;
      }
    case "deleteV2TasksTaskId": {
        
        
        let path = "/v2/tasks/{task_id}";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{task_id}").join(encodeURIComponent(String(this.getNodeParameter("task_id", itemIndex))));
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "DELETE" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"404":{"title":"Not Found"}};
        break;
      }
    case "getV2Tasks": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/v2/tasks";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        if (additionalFields["limit"] !== undefined) qs["limit"] = additionalFields["limit"];
    if (additionalFields["offset"] !== undefined) qs["offset"] = additionalFields["offset"];
    if (additionalFields["sort"] !== undefined) qs["sort"] = additionalFields["sort"];
    if (additionalFields["linked_object"] !== undefined) qs["linked_object"] = additionalFields["linked_object"];
    if (additionalFields["linked_record_id"] !== undefined) qs["linked_record_id"] = additionalFields["linked_record_id"];
    if (additionalFields["assignee"] !== undefined) qs["assignee"] = additionalFields["assignee"];
    if (additionalFields["is_completed"] !== undefined) qs["is_completed"] = additionalFields["is_completed"];
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
        errorPlan = {};
        break;
      }
    case "getV2TasksTaskId": {
        
        
        let path = "/v2/tasks/{task_id}";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{task_id}").join(encodeURIComponent(String(this.getNodeParameter("task_id", itemIndex))));
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
        errorPlan = {"404":{"title":"Not Found"}};
        break;
      }
    case "patchV2TasksTaskId": {
        
        
        let path = "/v2/tasks/{task_id}";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{task_id}").join(encodeURIComponent(String(this.getNodeParameter("task_id", itemIndex))));
        setBodyField(body as IDataObject, {"name":"data","displayName":"Data","type":"object","required":true,"representation":"raw","fields":[{"name":"assignees","displayName":"Assignees","description":"Workspace members assigned to this task.","type":"array","representation":"raw","items":{"name":"item","displayName":"Item","type":"alternative","composition":"anyOf","representation":"raw","alternatives":[{"name":"alternative1","displayName":"Alternative1","type":"object","representation":"raw","fields":[{"name":"referenced_actor_id","displayName":"Referenced actor id","description":"The ID of the actor assigned to this task.","type":"string","format":"uuid","required":true,"example":"50cf242c-7fa3-4cad-87d0-75b1af71c57b"},{"name":"referenced_actor_type","displayName":"Referenced actor type","description":"The actor type of the task assignee. Only `workspace-member` actors can be assigned to tasks. [Read more information on actor types here](/docs/actors).","type":"string","required":true,"enum":["workspace-member"],"example":"workspace-member"}]},{"name":"alternative2","displayName":"Alternative2","type":"object","representation":"raw","fields":[{"name":"workspace_member_email_address","displayName":"Workspace member email address","description":"Workspace member actors can be referenced by email address as well as actor ID.","type":"string","required":true,"example":"alice@attio.com"}]}]}},{"name":"deadline_at","displayName":"Deadline at","description":"The deadline of the task, in ISO 8601 format.","type":"string","example":"2023-01-01T15:00:00.000000000Z","nullable":true},{"name":"is_completed","displayName":"Is completed","description":"Whether the task has been completed.","type":"boolean","example":false},{"name":"linked_records","displayName":"Linked records","description":"Records linked to the task. Records can be linked by domain (for companies), email address (for people), record ID (for all objects) or by a unique matching attribute (for all objects). Creating record links within task content text is not possible via the API at present.","type":"alternative","composition":"anyOf","representation":"raw","alternatives":[{"name":"alternative1","displayName":"Alternative1","description":"An array of email addresses and/or company website domains. Email addresses are matched to person records via the `email_addresses` attribute; domains are matched to company records via the `domains` attribute.","type":"array","example":["person@company.com","fundstack.com"],"representation":"raw","items":{"name":"item","displayName":"Item","description":"An email address or company website domain.","type":"string","example":"person@company.com"}},{"name":"alternative2","displayName":"Alternative2","type":"array","representation":"raw","items":{"name":"item","displayName":"Item","type":"alternative","composition":"anyOf","representation":"raw","alternatives":[{"name":"alternative1","displayName":"Alternative1","type":"object","representation":"raw","fields":[{"name":"target_object","displayName":"Target object","description":"The ID or slug of the parent object the tasks refers to. This can reference both standard and custom objects.`","type":"string","required":true,"example":"people"},{"name":"target_record_id","displayName":"Target record id","description":"The ID of the parent record the task refers to.","type":"string","format":"uuid","required":true,"example":"891dcbfc-9141-415d-9b2a-2238a6cc012d"}]},{"name":"alternative2","displayName":"Alternative2","type":"object","example":{"matching_attribute_id_123":[{"value":"matching_attribute_id_123"}],"target_object":"people"},"representation":"raw","fields":[{"name":"[slug_or_id_of_matching_attribute]","displayName":"[slug or id of matching attribute]","description":"Reference a record by ID or one matching attribute. Set target_object, provide the matching attribute slug or ID, and pass one value in that attribute's expected format.","type":"array","required":true,"representation":"raw","items":{"name":"item","displayName":"Item","type":"alternative","composition":"anyOf","representation":"raw","alternatives":[{"name":"alternative1","displayName":"Alternative1","type":"object","representation":"raw","fields":[{"name":"domain","displayName":"Domain","description":"The full domain of the website.","type":"string","example":"app.attio.com"}]},{"name":"alternative2","displayName":"Alternative2","type":"object","representation":"raw","fields":[{"name":"email_address","displayName":"Email address","description":"An email address string","type":"string","example":"alice@app.attio.com"}]},{"name":"alternative3","displayName":"Alternative3","type":"object","representation":"raw","fields":[{"name":"value","displayName":"Value","description":"Numbers are persisted as 64 bit floats.","type":"number","example":17224912}]},{"name":"alternative4","displayName":"Alternative4","type":"object","representation":"raw","fields":[{"name":"country_code","displayName":"Country code","description":"The ISO 3166-1 alpha-2 country code representing the country that this phone number belongs to.","type":"string","enum":["AF","AX","AL","DZ","AS","AD","AO","AI","AQ","AG","AR","AM","AW","AU","AT","AZ","BS","BH","BD","BB","BY","BE","BZ","BJ","BM","BT","BO","BA","BW","BV","BR","IO","BN","BG","BF","BI","KH","CM","CA","CV","KY","CF","TD","CL","CN","CX","CC","CO","KM","CG","CD","CK","CR","CI","HR","CU","CW","CY","CZ","DK","DJ","DM","DO","EC","EG","SV","GQ","ER","EE","ET","FK","FO","FJ","FI","FR","GF","PF","TF","GA","GM","GE","DE","GH","GI","GR","GL","GD","GP","GU","GT","GG","GN","GW","GY","HT","HM","VA","HN","HK","HU","IS","IN","ID","IR","IQ","IE","IM","IL","IT","JM","JP","JE","JO","KZ","KE","KI","KR","KW","KG","LA","LV","LB","LS","LR","LY","LI","LT","LU","MO","MK","MG","MW","MY","MV","ML","MT","MH","MQ","MR","MU","YT","MX","FM","MD","MC","MN","ME","MS","MA","MZ","MM","NA","NR","NP","NL","AN","NC","NZ","NI","NE","NG","NU","NF","MP","NO","OM","PK","PW","PS","PA","PG","PY","PE","PH","PN","PL","PT","PR","QA","RE","RO","RU","RW","BL","SH","KN","LC","MF","PM","VC","WS","SM","ST","SA","SN","SS","RS","SC","SL","SG","SK","SI","SB","SO","ZA","GS","ES","LK","SD","SR","SJ","SZ","SE","CH","SY","TW","TJ","TZ","TH","TL","TG","TK","TO","TT","TN","TR","TM","TC","TV","UG","UA","AE","GB","US","UM","UY","UZ","VU","VE","VN","VG","VI","WF","EH","YE","ZM","ZW","BQ","KP","SX","XK","AC"],"example":"GB","nullable":true},{"name":"original_phone_number","displayName":"Original phone number","description":"The raw, original phone number, as inputted.","type":"string","example":"07234172834"}]},{"name":"alternative5","displayName":"Alternative5","type":"object","representation":"raw","fields":[{"name":"value","displayName":"Value","description":"A raw text field. Values are limited to 10MB.","type":"string"}]}]}},{"name":"target_object","displayName":"Target object","description":"A UUID or slug to identify the object that the referenced record belongs to.","type":"string","required":true,"example":"people"}]}]}}]}]}, this.getNodeParameter("data", itemIndex), this, itemIndex);
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "PATCH" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
        errorPlan = {"400":{"title":"Bad Request"},"404":{"title":"Not Found"}};
        break;
      }
    case "postV2Tasks": {
        
        
        const path = "/v2/tasks";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        setBodyField(body as IDataObject, {"name":"data","displayName":"Data","type":"object","required":true,"representation":"raw","fields":[{"name":"assignees","displayName":"Assignees","description":"Workspace members assigned to this task.","type":"array","required":true,"representation":"raw","items":{"name":"item","displayName":"Item","type":"alternative","composition":"anyOf","representation":"raw","alternatives":[{"name":"alternative1","displayName":"Alternative1","type":"object","representation":"raw","fields":[{"name":"referenced_actor_id","displayName":"Referenced actor id","description":"The ID of the actor assigned to this task.","type":"string","format":"uuid","required":true,"example":"50cf242c-7fa3-4cad-87d0-75b1af71c57b"},{"name":"referenced_actor_type","displayName":"Referenced actor type","description":"The actor type of the task assignee. Only `workspace-member` actors can be assigned to tasks. [Read more information on actor types here](/docs/actors).","type":"string","required":true,"enum":["workspace-member"],"example":"workspace-member"}]},{"name":"alternative2","displayName":"Alternative2","type":"object","representation":"raw","fields":[{"name":"workspace_member_email_address","displayName":"Workspace member email address","description":"Workspace member actors can be referenced by email address as well as actor ID.","type":"string","required":true,"example":"alice@attio.com"}]}]}},{"name":"content","displayName":"Content","description":"The text content of the task, in the format specified by the `format` property. A max length of 2000 characters is enforced.","type":"string","required":true,"example":"Follow up on current software solutions"},{"name":"deadline_at","displayName":"Deadline at","description":"The deadline of the task, in ISO 8601 format.","type":"string","required":true,"example":"2023-01-01T15:00:00.000000000Z","nullable":true},{"name":"format","displayName":"Format","description":"The format of the task content to be created. Rich text formatting, links and @references are not supported.","type":"string","required":true,"enum":["plaintext"]},{"name":"is_completed","displayName":"Is completed","description":"Whether the task has been completed.","type":"boolean","required":true,"example":false},{"name":"linked_records","displayName":"Linked records","description":"Records linked to the task. Records can be linked by domain (for companies), email address (for people), record ID (for all objects) or by a unique matching attribute (for all objects). Creating record links within task content text is not possible via the API at present.","type":"alternative","required":true,"composition":"anyOf","representation":"raw","alternatives":[{"name":"alternative1","displayName":"Alternative1","description":"An array of email addresses and/or company website domains. Email addresses are matched to person records via the `email_addresses` attribute; domains are matched to company records via the `domains` attribute.","type":"array","example":["person@company.com","fundstack.com"],"representation":"raw","items":{"name":"item","displayName":"Item","description":"An email address or company website domain.","type":"string","example":"person@company.com"}},{"name":"alternative2","displayName":"Alternative2","type":"array","representation":"raw","items":{"name":"item","displayName":"Item","type":"alternative","composition":"anyOf","representation":"raw","alternatives":[{"name":"alternative1","displayName":"Alternative1","type":"object","representation":"raw","fields":[{"name":"target_object","displayName":"Target object","description":"The ID or slug of the parent object the tasks refers to. This can reference both standard and custom objects.`","type":"string","required":true,"example":"people"},{"name":"target_record_id","displayName":"Target record id","description":"The ID of the parent record the task refers to.","type":"string","format":"uuid","required":true,"example":"891dcbfc-9141-415d-9b2a-2238a6cc012d"}]},{"name":"alternative2","displayName":"Alternative2","type":"object","example":{"matching_attribute_id_123":[{"value":"matching_attribute_id_123"}],"target_object":"people"},"representation":"raw","fields":[{"name":"[slug_or_id_of_matching_attribute]","displayName":"[slug or id of matching attribute]","description":"Reference a record by ID or one matching attribute. Set target_object, provide the matching attribute slug or ID, and pass one value in that attribute's expected format.","type":"array","required":true,"representation":"raw","items":{"name":"item","displayName":"Item","type":"alternative","composition":"anyOf","representation":"raw","alternatives":[{"name":"alternative1","displayName":"Alternative1","type":"object","representation":"raw","fields":[{"name":"domain","displayName":"Domain","description":"The full domain of the website.","type":"string","example":"app.attio.com"}]},{"name":"alternative2","displayName":"Alternative2","type":"object","representation":"raw","fields":[{"name":"email_address","displayName":"Email address","description":"An email address string","type":"string","example":"alice@app.attio.com"}]},{"name":"alternative3","displayName":"Alternative3","type":"object","representation":"raw","fields":[{"name":"value","displayName":"Value","description":"Numbers are persisted as 64 bit floats.","type":"number","example":17224912}]},{"name":"alternative4","displayName":"Alternative4","type":"object","representation":"raw","fields":[{"name":"country_code","displayName":"Country code","description":"The ISO 3166-1 alpha-2 country code representing the country that this phone number belongs to.","type":"string","enum":["AF","AX","AL","DZ","AS","AD","AO","AI","AQ","AG","AR","AM","AW","AU","AT","AZ","BS","BH","BD","BB","BY","BE","BZ","BJ","BM","BT","BO","BA","BW","BV","BR","IO","BN","BG","BF","BI","KH","CM","CA","CV","KY","CF","TD","CL","CN","CX","CC","CO","KM","CG","CD","CK","CR","CI","HR","CU","CW","CY","CZ","DK","DJ","DM","DO","EC","EG","SV","GQ","ER","EE","ET","FK","FO","FJ","FI","FR","GF","PF","TF","GA","GM","GE","DE","GH","GI","GR","GL","GD","GP","GU","GT","GG","GN","GW","GY","HT","HM","VA","HN","HK","HU","IS","IN","ID","IR","IQ","IE","IM","IL","IT","JM","JP","JE","JO","KZ","KE","KI","KR","KW","KG","LA","LV","LB","LS","LR","LY","LI","LT","LU","MO","MK","MG","MW","MY","MV","ML","MT","MH","MQ","MR","MU","YT","MX","FM","MD","MC","MN","ME","MS","MA","MZ","MM","NA","NR","NP","NL","AN","NC","NZ","NI","NE","NG","NU","NF","MP","NO","OM","PK","PW","PS","PA","PG","PY","PE","PH","PN","PL","PT","PR","QA","RE","RO","RU","RW","BL","SH","KN","LC","MF","PM","VC","WS","SM","ST","SA","SN","SS","RS","SC","SL","SG","SK","SI","SB","SO","ZA","GS","ES","LK","SD","SR","SJ","SZ","SE","CH","SY","TW","TJ","TZ","TH","TL","TG","TK","TO","TT","TN","TR","TM","TC","TV","UG","UA","AE","GB","US","UM","UY","UZ","VU","VE","VN","VG","VI","WF","EH","YE","ZM","ZW","BQ","KP","SX","XK","AC"],"example":"GB","nullable":true},{"name":"original_phone_number","displayName":"Original phone number","description":"The raw, original phone number, as inputted.","type":"string","example":"07234172834"}]},{"name":"alternative5","displayName":"Alternative5","type":"object","representation":"raw","fields":[{"name":"value","displayName":"Value","description":"A raw text field. Values are limited to 10MB.","type":"string"}]}]}},{"name":"target_object","displayName":"Target object","description":"A UUID or slug to identify the object that the referenced record belongs to.","type":"string","required":true,"example":"people"}]}]}}]}]}, this.getNodeParameter("data", itemIndex), this, itemIndex);
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
        errorPlan = {"400":{"title":"Bad Request"},"404":{"title":"Not Found"}};
        break;
      }
    case "getV2Threads": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/v2/threads";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        if (additionalFields["record_id"] !== undefined) qs["record_id"] = additionalFields["record_id"];
    if (additionalFields["object"] !== undefined) qs["object"] = additionalFields["object"];
    if (additionalFields["entry_id"] !== undefined) qs["entry_id"] = additionalFields["entry_id"];
    if (additionalFields["list"] !== undefined) qs["list"] = additionalFields["list"];
    if (additionalFields["limit"] !== undefined) qs["limit"] = additionalFields["limit"];
    if (additionalFields["offset"] !== undefined) qs["offset"] = additionalFields["offset"];
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
        errorPlan = {};
        break;
      }
    case "getV2ThreadsThreadId": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        let path = "/v2/threads/{thread_id}";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{thread_id}").join(encodeURIComponent(String(this.getNodeParameter("thread_id", itemIndex))));
    if (additionalFields["limit"] !== undefined) qs["limit"] = additionalFields["limit"];
    if (additionalFields["cursor"] !== undefined) qs["cursor"] = additionalFields["cursor"];
    if (additionalFields["created_after"] !== undefined) qs["created_after"] = additionalFields["created_after"];
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","pagination"], simplified: ["data","pagination"] };
        errorPlan = {"404":{"title":"Not Found"}};
        break;
      }
    case "getV2MeetingsMeetingIdCallRecordingsCallRecordingIdTranscript": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        let path = "/v2/meetings/{meeting_id}/call_recordings/{call_recording_id}/transcript";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{meeting_id}").join(encodeURIComponent(String(this.getNodeParameter("meeting_id", itemIndex))));
    path = path.split("{call_recording_id}").join(encodeURIComponent(String(this.getNodeParameter("call_recording_id", itemIndex))));
    if (additionalFields["cursor"] !== undefined) qs["cursor"] = additionalFields["cursor"];
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","pagination"], simplified: ["data","pagination"] };
        errorPlan = {};
        break;
      }
    case "deleteV2WebhooksWebhookId": {
        
        
        let path = "/v2/webhooks/{webhook_id}";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{webhook_id}").join(encodeURIComponent(String(this.getNodeParameter("webhook_id", itemIndex))));
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "DELETE" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"404":{"title":"Not Found"}};
        break;
      }
    case "getV2Webhooks": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/v2/webhooks";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        if (additionalFields["limit"] !== undefined) qs["limit"] = additionalFields["limit"];
    if (additionalFields["offset"] !== undefined) qs["offset"] = additionalFields["offset"];
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
        errorPlan = {};
        break;
      }
    case "getV2WebhooksWebhookId": {
        
        
        let path = "/v2/webhooks/{webhook_id}";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{webhook_id}").join(encodeURIComponent(String(this.getNodeParameter("webhook_id", itemIndex))));
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
        errorPlan = {"404":{"title":"Not Found"}};
        break;
      }
    case "patchV2WebhooksWebhookId": {
        
        
        let path = "/v2/webhooks/{webhook_id}";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{webhook_id}").join(encodeURIComponent(String(this.getNodeParameter("webhook_id", itemIndex))));
        setBodyField(body as IDataObject, {"name":"data","displayName":"Data","type":"object","required":true,"representation":"raw","fields":[{"name":"subscriptions","displayName":"Subscriptions","description":"One or more events the webhook is subscribed to.\n\nWithin a workspace, the combination of target URL, event type and filter must be unique across all of your webhooks. A duplicate — whether against another webhook or repeated within a single request — is rejected with a `409 uniqueness_conflict`.","type":"array","representation":"raw","items":{"name":"item","displayName":"Item","type":"object","representation":"raw","fields":[{"name":"event_type","displayName":"Event type","description":"Type of event the webhook is subscribed to.","type":"string","required":true,"enum":["activity.created","activity.updated","activity.deleted","activity-attribute.created","activity-attribute.updated","activity-record.created","activity-record.deleted","call-recording.created","comment.created","comment.resolved","comment.unresolved","comment.deleted","list.created","list.updated","list.deleted","list-attribute.created","list-attribute.updated","list-entry.created","list-entry.updated","list-entry.deleted","object-attribute.created","object-attribute.updated","note.created","note-content.updated","note.updated","note.deleted","record.created","record.merged","record.updated","record.deleted","task.created","task.updated","task.deleted","workspace-member.created"],"example":"note.created"},{"name":"filter","displayName":"Filter","description":"Filters to determine whether the webhook event should be sent. If null, the filter always passes.\n\nWhen filters are compared for uniqueness, key order and the order of operations are ignored.","type":"alternative","required":true,"example":{"$and":[{"field":"parent_object_id","operator":"equals","value":"97052eb9-e65e-443f-a297-f2d9a4a7f795"}]},"composition":"anyOf","representation":"raw","nullable":true,"alternatives":[{"name":"alternative1","displayName":"Alternative1","type":"object","representation":"raw","fields":[{"name":"$or","displayName":"$or","type":"array","required":true,"representation":"raw","items":{"name":"item","displayName":"Item","type":"alternative","composition":"anyOf","representation":"raw","alternatives":[{"name":"alternative1","displayName":"Alternative1","type":"object","representation":"raw","fields":[{"name":"field","displayName":"Field","type":"string","required":true},{"name":"operator","displayName":"Operator","type":"string","required":true,"enum":["equals"]},{"name":"value","displayName":"Value","type":"string","required":true}]},{"name":"alternative2","displayName":"Alternative2","type":"object","representation":"raw","fields":[{"name":"field","displayName":"Field","type":"string","required":true},{"name":"operator","displayName":"Operator","type":"string","required":true,"enum":["not_equals"]},{"name":"value","displayName":"Value","type":"string","required":true}]}]}}]},{"name":"alternative2","displayName":"Alternative2","type":"object","representation":"raw","fields":[{"name":"$and","displayName":"$and","type":"array","required":true,"representation":"raw","items":{"name":"item","displayName":"Item","type":"alternative","composition":"anyOf","representation":"raw","alternatives":[{"name":"alternative1","displayName":"Alternative1","type":"object","representation":"raw","fields":[{"name":"field","displayName":"Field","type":"string","required":true},{"name":"operator","displayName":"Operator","type":"string","required":true,"enum":["equals"]},{"name":"value","displayName":"Value","type":"string","required":true}]},{"name":"alternative2","displayName":"Alternative2","type":"object","representation":"raw","fields":[{"name":"field","displayName":"Field","type":"string","required":true},{"name":"operator","displayName":"Operator","type":"string","required":true,"enum":["not_equals"]},{"name":"value","displayName":"Value","type":"string","required":true}]}]}}]}]}]}},{"name":"target_url","displayName":"Target url","description":"URL where the webhook events will be delivered to.","type":"string","format":"uri","example":"https://example.com/webhook","pattern":"^https:\\/\\/.*"}]}, this.getNodeParameter("data", itemIndex), this, itemIndex);
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "PATCH" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
        errorPlan = {"404":{"title":"Not Found"},"409":{"title":"Conflict"}};
        break;
      }
    case "postV2Webhooks": {
        
        
        const path = "/v2/webhooks";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        setBodyField(body as IDataObject, {"name":"data","displayName":"Data","type":"object","required":true,"representation":"raw","fields":[{"name":"subscriptions","displayName":"Subscriptions","description":"One or more events the webhook is subscribed to.\n\nWithin a workspace, the combination of target URL, event type and filter must be unique across all of your webhooks. A duplicate — whether against another webhook or repeated within a single request — is rejected with a `409 uniqueness_conflict`.","type":"array","required":true,"representation":"raw","items":{"name":"item","displayName":"Item","type":"object","representation":"raw","fields":[{"name":"event_type","displayName":"Event type","description":"Type of event the webhook is subscribed to.","type":"string","required":true,"enum":["activity.created","activity.updated","activity.deleted","activity-attribute.created","activity-attribute.updated","activity-record.created","activity-record.deleted","call-recording.created","comment.created","comment.resolved","comment.unresolved","comment.deleted","list.created","list.updated","list.deleted","list-attribute.created","list-attribute.updated","list-entry.created","list-entry.updated","list-entry.deleted","object-attribute.created","object-attribute.updated","note.created","note-content.updated","note.updated","note.deleted","record.created","record.merged","record.updated","record.deleted","task.created","task.updated","task.deleted","workspace-member.created"],"example":"note.created"},{"name":"filter","displayName":"Filter","description":"Filters to determine whether the webhook event should be sent. If null, the filter always passes.\n\nWhen filters are compared for uniqueness, key order and the order of operations are ignored.","type":"alternative","required":true,"example":{"$and":[{"field":"parent_object_id","operator":"equals","value":"97052eb9-e65e-443f-a297-f2d9a4a7f795"}]},"composition":"anyOf","representation":"raw","nullable":true,"alternatives":[{"name":"alternative1","displayName":"Alternative1","type":"object","representation":"raw","fields":[{"name":"$or","displayName":"$or","type":"array","required":true,"representation":"raw","items":{"name":"item","displayName":"Item","type":"alternative","composition":"anyOf","representation":"raw","alternatives":[{"name":"alternative1","displayName":"Alternative1","type":"object","representation":"raw","fields":[{"name":"field","displayName":"Field","type":"string","required":true},{"name":"operator","displayName":"Operator","type":"string","required":true,"enum":["equals"]},{"name":"value","displayName":"Value","type":"string","required":true}]},{"name":"alternative2","displayName":"Alternative2","type":"object","representation":"raw","fields":[{"name":"field","displayName":"Field","type":"string","required":true},{"name":"operator","displayName":"Operator","type":"string","required":true,"enum":["not_equals"]},{"name":"value","displayName":"Value","type":"string","required":true}]}]}}]},{"name":"alternative2","displayName":"Alternative2","type":"object","representation":"raw","fields":[{"name":"$and","displayName":"$and","type":"array","required":true,"representation":"raw","items":{"name":"item","displayName":"Item","type":"alternative","composition":"anyOf","representation":"raw","alternatives":[{"name":"alternative1","displayName":"Alternative1","type":"object","representation":"raw","fields":[{"name":"field","displayName":"Field","type":"string","required":true},{"name":"operator","displayName":"Operator","type":"string","required":true,"enum":["equals"]},{"name":"value","displayName":"Value","type":"string","required":true}]},{"name":"alternative2","displayName":"Alternative2","type":"object","representation":"raw","fields":[{"name":"field","displayName":"Field","type":"string","required":true},{"name":"operator","displayName":"Operator","type":"string","required":true,"enum":["not_equals"]},{"name":"value","displayName":"Value","type":"string","required":true}]}]}}]}]}]}},{"name":"target_url","displayName":"Target url","description":"URL where the webhook events will be delivered to.","type":"string","format":"uri","required":true,"example":"https://example.com/webhook","pattern":"^https:\\/\\/.*"}]}, this.getNodeParameter("data", itemIndex), this, itemIndex);
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
        errorPlan = {"400":{"title":"Bad Request"},"409":{"title":"Conflict"}};
        break;
      }
    case "getV2WorkspaceMembers": {
        
        
        const path = "/v2/workspace_members";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
        errorPlan = {};
        break;
      }
    case "getV2WorkspaceMembersWorkspaceMemberId": {
        
        
        let path = "/v2/workspace_members/{workspace_member_id}";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{workspace_member_id}").join(encodeURIComponent(String(this.getNodeParameter("workspace_member_id", itemIndex))));
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiAttioCom","url":"https://api.attio.com","kind":"selectable","variables":[]}], "documentServer1HttpsApiAttioCom", nodeOptions, false);
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"attioOAuth2Api","type":"oauth2"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
        errorPlan = {"404":{"title":"Not Found"}};
        break;
      }
          default: throw new NodeOperationError(this.getNode(), `Unsupported operation ${operation} for node version ${nodeVersion}`, { itemIndex });
        }
        const returnAll = pagination.style !== 'none' ? Boolean(nodeOptions.returnAll ?? false) : false;
    const resultLimit = pagination.style !== 'none' && !returnAll ? Number(nodeOptions.resultLimit ?? 50) : Math.min(pagination.maxItems, Number.POSITIVE_INFINITY);
    const pageStartTime = Date.now();
    const seenCursors = new Map<string, number>(); const seenPages = new Map<string, number>();
    let page = 1; let offset = 0; let cursor: unknown; let pagesFetched = 0; let estimatedBytes = 0; let finished = false;
    while (!finished && output.length - outputStart < resultLimit && pagesFetched < pagination.maxPages) {
      if (Date.now() - pageStartTime > pagination.maxElapsedMs) throw new NodeOperationError(this.getNode(), 'Pagination elapsed-time budget was exceeded', { itemIndex });
      const qs = options.qs as IDataObject;
      // Only the paginator's own page size is written here. It used to overwrite a
      // limit parameter the operation itself declared and the user had just set.
      if (pagination.limit && (pagesFetched > 0 || qs[pagination.limit] === undefined)) qs[pagination.limit] = Math.min(pagination.pageSize, resultLimit - (output.length - outputStart));
      if (pagination.style === 'offset' && pagination.page) qs[pagination.page] = offset;
      if (pagination.style === 'pageNumber' && pagination.page) qs[pagination.page] = page;
      if (pagination.style === 'cursor' && pagination.cursor && cursor) qs[pagination.cursor] = cursor as string;
      const response = await requestWithRetry(this as never, options, credentialApplications, retryContract, itemIndex);
      pagesFetched += 1;
      const pageFingerprint = JSON.stringify(response);
      const pageRepeats = (seenPages.get(pageFingerprint) ?? 0) + 1;
      seenPages.set(pageFingerprint, pageRepeats);
      if (pageRepeats > pagination.repeatedPageLimit) throw new NodeOperationError(this.getNode(), 'Pagination repeated-page budget was exceeded', { itemIndex });
      estimatedBytes += pageFingerprint.length;
      if (estimatedBytes > pagination.maxMemoryBytes) throw new NodeOperationError(this.getNode(), 'Pagination memory budget was exceeded', { itemIndex });
      if (responsePlan.binary) {
        const binaryPayload = responsePlan.full ? ((response as IDataObject).body ?? response) : response;
        const responseHeaders = (responsePlan.full ? ((response as IDataObject).headers as IDataObject | undefined) : undefined) ?? {};
        const contentType = String(responseHeaders['content-type'] ?? '').split(';')[0].trim() || 'application/octet-stream';
        // prepareBinaryData is what fills in fileName, fileSize and fileExtension.
        // Hand-building the binary entry produced items that downstream nodes could
        // not name or type, and discarded the response's own content type.
        const binaryData = await this.helpers.prepareBinaryData(Buffer.from(binaryPayload as ArrayBuffer), undefined, contentType);
        output.push({ json: {}, binary: { data: binaryData }, pairedItem: { item: itemIndex } });
        finished = true;
        continue;
      }
      const normalizedResponse = responsePlan.full ? ((response as IDataObject).body ?? response) : response;
      const envelopeValue = valueAtPath(normalizedResponse, responsePlan.envelopePath);
      if (responsePlan.envelopePath && envelopeValue === undefined) throw new NodeOperationError(this.getNode(), `Response envelope path "${responsePlan.envelopePath}" was not found`, { itemIndex });
      const envelope = (envelopeValue ?? normalizedResponse) as IDataObject;
      const itemPath = pagination.itemPath || responsePlan.itemPath;
      const extractedItems = valueAtPath(envelope, itemPath);
      if (itemPath && extractedItems === undefined) throw new NodeOperationError(this.getNode(), `Response item path "${itemPath}" was not found`, { itemIndex });
      // A DELETE used to be reported as a fixed { deleted: true } with its body
      // thrown away, which lost the deleted representation and the job handle that
      // asynchronous deletes return. The body is used when there is one.
      const deletedFallback = options.method === 'DELETE' && (normalizedResponse === undefined || normalizedResponse === null || normalizedResponse === '' ||
        (typeof normalizedResponse === 'object' && !Array.isArray(normalizedResponse) && Object.keys(normalizedResponse as IDataObject).length === 0));
      const values = deletedFallback
        ? [{ deleted: true }]
        : Array.isArray(extractedItems) ? extractedItems : Array.isArray(normalizedResponse) ? normalizedResponse : [extractedItems ?? envelope];
      const outputMode = responsePlan.fields.length > 10 ? this.getNodeParameter('outputMode', itemIndex, 'simplified') as string : 'raw';
      const selectedFields = outputMode === 'selected' ? this.getNodeParameter('selectedFields', itemIndex, []) as string[] : [];
      for (const value of values) {
        if (output.length - outputStart >= resultLimit) break;
        const fields = outputMode === 'simplified' ? responsePlan.simplified : outputMode === 'selected' ? selectedFields : [];
        output.push({ json: selectResponseFields(value as IDataObject, fields), pairedItem: { item: itemIndex } });
      }
      if (!returnAll || pagination.style === 'none' || values.length === 0) { finished = true; continue; }
      if (pagination.hasMore && envelope[pagination.hasMore] === false) { finished = true; continue; }
      if (pagination.style === 'cursor') {
        cursor = pagination.responseCursor ? valueAtPath(envelope, pagination.responseCursor) : undefined;
        finished = !cursor;
        if (cursor) {
          const key = String(cursor);
          const repeats = (seenCursors.get(key) ?? 0) + 1;
          seenCursors.set(key, repeats);
          if (repeats > pagination.repeatedCursorLimit) throw new NodeOperationError(this.getNode(), 'Pagination repeated-cursor budget was exceeded', { itemIndex });
        }
      }
      if (pagination.advancement === 'offsetByItems') offset += values.length;
      if (pagination.advancement === 'incrementPage') page += 1;
    }
      } catch (error) {
        if (this.continueOnFail()) {
          output.push({ json: { error: (error as Error).message }, pairedItem: { item: itemIndex } });
          continue;
        }
        if (error instanceof NodeApiError) {
          const status = String((error as unknown as { httpCode?: string; cause?: { statusCode?: number } }).httpCode ?? (error as unknown as { cause?: { statusCode?: number } }).cause?.statusCode ?? 'default');
          const planned = errorPlan[status] ?? errorPlan.default;
          if (planned) {
            const parameterHelp = planned.parameter ? `Check the '${planned.parameter}' parameter.` : undefined;
            const description = [planned.recovery, parameterHelp].filter(Boolean).join(' ');
            throw new NodeApiError(this.getNode(), error as unknown as JsonObject, { itemIndex, message: planned.title, description });
          }
        }
        if (error instanceof NodeApiError) throw new NodeApiError(this.getNode(), error as unknown as JsonObject, { itemIndex });
        throw new NodeOperationError(this.getNode(), error as Error, { itemIndex });
      }
    }
    return [output];
  }
}
