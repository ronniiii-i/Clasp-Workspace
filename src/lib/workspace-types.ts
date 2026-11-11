import type {
  DataScope,
  ModuleDepartment,
  ModuleType,
  Permission,
} from "./modules";

/**
 * Client-side mirror of the backend workspace contracts.
 *
 * These types describe the payload returned by
 * `GET /workspace/modules/:deptKey/:moduleKey` and the renderer configs stored
 * on `modules.config`. Keep them in sync with
 * `crm-backend/src/workspace/types/{module-config,entity}.ts`.
 */

export const MODULE_CONFIG_VERSION = 1;

export interface TableColumnConfig {
  field: string;
  label: string;
  type?: string;
  sortable?: boolean;
  filterable?: boolean;
  width?: number;
}

export interface TableFilterConfig {
  field: string;
  label: string;
  options?: string[];
}

export interface TableConfig {
  version: typeof MODULE_CONFIG_VERSION;
  entity: string | null;
  columns: TableColumnConfig[];
  defaultSort: { field: string; dir: "asc" | "desc" };
  pageSize: number;
  searchFields: string[];
  createEnabled: boolean;
  filters: TableFilterConfig[];
}

export interface KanbanColumnConfig {
  value: string;
  label: string;
  color: string;
}

export interface KanbanConfig {
  version: typeof MODULE_CONFIG_VERSION;
  entity: string | null;
  statusField: string;
  columns: KanbanColumnConfig[];
  secondaryColumns: KanbanColumnConfig[];
  titleField: string;
  valueField: string | null;
  assigneeField: string | null;
  dueField: string | null;
  allowCreate: boolean;
  allowMove: boolean;
}

export type AggregationKind = "SUM" | "AVG" | "COUNT" | "MIN" | "MAX";

export type WidgetKind = "stat" | "bar" | "line" | "pie";

export type Timeframe =
  | "LAST_7_DAYS"
  | "LAST_30_DAYS"
  | "LAST_90_DAYS"
  | "MTD"
  | "QTD"
  | "YTD"
  | "ALL";

export interface AggregateFilter {
  field: string;
  op?: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in" | "contains";
  value?: unknown;
}

export interface DashboardWidget {
  id: string;
  kind: WidgetKind;
  title: string;
  entity: string;
  aggregation: AggregationKind;
  field: string;
  timeframe: Timeframe;
  filters: AggregateFilter[];
  groupBy: string | null;
  format: "number" | "currency" | "percent";
  color: string;
  span: number;
}

export interface DashboardConfig {
  version: typeof MODULE_CONFIG_VERSION;
  layout: "grid";
  columns: number;
  widgets: DashboardWidget[];
}

export interface DocumentConfig {
  version: typeof MODULE_CONFIG_VERSION;
  categories: string[];
  defaultFormat: "MARKDOWN" | "RICH_TEXT";
  allowCreate: boolean;
  allowRichText: boolean;
}

export interface FormFieldConfig {
  name: string;
  label: string;
  type:
    | "text"
    | "textarea"
    | "number"
    | "currency"
    | "date"
    | "select"
    | "checkbox"
    | "email";
  required?: boolean;
  options?: string[];
  mapTo?: "column" | "customFields";
}

export interface FormConfig {
  version: typeof MODULE_CONFIG_VERSION;
  entity: string | null;
  mode: "create";
  fields: FormFieldConfig[];
  submitLabel: string;
  successMessage: string;
}

export interface WorkflowStageConfig {
  value: string;
  label: string;
}

export interface WorkflowConfig {
  version: typeof MODULE_CONFIG_VERSION;
  entity: string | null;
  /** Identifies the state machine that drives this module. */
  workflow: string;
  stages: WorkflowStageConfig[];
  /** Fields a requester supplies when creating a record. */
  requesterFields: string[];
  allowCreate: boolean;
  allowCancel: boolean;
}

export type ModuleConfig =
  | TableConfig
  | KanbanConfig
  | DashboardConfig
  | DocumentConfig
  | FormConfig
  | WorkflowConfig;

export type EntityFieldType =
  | "text"
  | "email"
  | "number"
  | "currency"
  | "date"
  | "enum"
  | "boolean"
  | "json"
  | "string[]";

export interface EntityFieldReference {
  entity: "users" | "projects" | "departments" | "contacts";
  labelField: string;
  secondaryFields?: string[];
  relationField?: string;
  filter?: Record<string, unknown>;
}

export interface EntityFieldMeta {
  name: string;
  label: string;
  type: EntityFieldType;
  relation?: boolean;
  sortable?: boolean;
  filterable?: boolean;
  searchable?: boolean;
  groupable?: boolean;
  writable?: boolean;
  required?: boolean;
  readOnly?: boolean;
  enumValues?: string[];
  description?: string;
  reference?: EntityFieldReference;
  selfEditable?: boolean;
  sensitive?: boolean;
}

export interface EntityMeta {
  key: string;
  label: string;
  fields: EntityFieldMeta[];
  displayField?: string;
  secondaryDisplayFields?: string[];
  selfEditableFields?: string[];
  defaultSort: { field: string; dir: "asc" | "desc" };
  searchFields: string[];
  statusField: string | null;
  statusOptions: string[];
  numericFields: string[];
  dateFields: string[];
  groupableFields: string[];
  supportedScopes: DataScope[];
  readOnly: boolean;
  softDelete?: boolean;
  reassignable?: boolean;
}

export interface ModuleDefinition {
  id: string;
  key: string;
  path: string;
  name: string;
  icon: string;
  group: string;
  order: number;
  type: ModuleType;
  targetEntity: string | null;
  config: ModuleConfig;
  isNavigable: boolean;
  description: string | null;
  department: ModuleDepartment | null;
  dataScope: DataScope;
  actions: Permission[];
  features?: { attachments?: boolean };
  entityMeta: EntityMeta | null;
}

export interface ModuleDefinitionKey {
  deptKey: string;
  moduleKey: string;
}

/**
 * Response and request contracts for the Stage 6 renderer endpoints.
 * Mirrors `crm-backend/src/workspace/{controllers,dto}`.
 */

export type FilterOperator =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "in"
  | "contains"
  | "startsWith"
  | "endsWith"
  | "isNull";

export interface RecordFilter {
  field: string;
  op?: FilterOperator;
  value?: unknown;
}

export interface RecordsQuery {
  search?: string;
  page?: number;
  pageSize?: number;
  sort?: { field: string; dir: "asc" | "desc" };
  filters?: RecordFilter[];
  include?: string[];
}

export interface ListMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export type WorkspaceRecord = { id: string } & Record<string, unknown>;

/** A user eligible to receive a reassigned record. */
export interface AssigneeUser {
  id: string;
  name: string;
  email?: string | null;
  departmentId?: string | null;
  roleId?: string | null;
  status?: string | null;
}

export interface RecordsPage<Row = WorkspaceRecord> {
  data: Row[];
  meta: ListMeta;
  scope: DataScope;
}

/** Relation dropdown option returned by the lookups endpoint. */
export interface LookupOption {
  value: string;
  label: string;
  secondary?: string | null;
  meta?: Record<string, unknown>;
}

export interface LookupResponse {
  field: string;
  options: LookupOption[];
}

export interface LookupQuery {
  q?: string;
  limit?: number;
  ids?: string[];
}

export interface AttachmentRecord {
  id: string;
  entity: string;
  entityId: string;
  key: string;
  fileName: string;
  mimeType: string;
  size: number;
  uploadedById: string;
  createdAt: string;
  downloadUrl: string;
  uploader?: { id: string; name: string; email?: string | null } | null;
}

export interface AttachmentListResponse {
  data: AttachmentRecord[];
}

export interface PresignUploadResult {
  uploadUrl: string;
  key: string;
  publicUrl: string;
  headers: Record<string, string>;
  expiresAt: string;
}

export interface RegisterAttachmentInput {
  key: string;
  fileName: string;
  mimeType: string;
  size: number;
}

export interface AggregateSeriesPoint {
  key: string | null;
  value: number | null;
}

export interface AggregateWidgetResult {
  id: string;
  value?: number | null;
  series?: AggregateSeriesPoint[];
  error?: { code: string; message: string };
}

export interface AggregateResponse {
  results: AggregateWidgetResult[];
  generatedAt: string;
  scope: DataScope;
}

export type DocumentStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type DocumentFormat = "MARKDOWN" | "RICH_TEXT";

export interface DocumentRecord {
  id: string;
  title: string;
  slug: string;
  format: DocumentFormat;
  status: DocumentStatus;
  category: string | null;
  version: number;
  departmentId: string | null;
  createdById: string | null;
  updatedById: string | null;
  createdAt: string;
  updatedAt: string;
  content?: string;
}

export interface DocumentListQuery {
  search?: string;
  category?: string;
  status?: DocumentStatus;
  page?: number;
  pageSize?: number;
}

export interface DocumentPage {
  data: DocumentRecord[];
  meta: ListMeta;
}

export interface DocumentInput {
  title?: string;
  content?: string;
  format?: DocumentFormat;
  status?: DocumentStatus;
  category?: string | null;
}

export interface SubmissionRecord {
  id: string;
  moduleId: string;
  entityId: string | null;
  submittedById: string;
  data: Record<string, unknown>;
  status: string;
  createdAt: string;
  updatedAt: string;
  submittedBy?: { id: string; name: string; email: string } | null;
}

export interface SubmissionPage {
  data: SubmissionRecord[];
  meta: ListMeta;
  scope: DataScope;
}

export interface SubmissionResult {
  submissionId: string;
  entityId?: string;
  status: string;
}

// Leave workflow ----------------------------------------------------------

export type LeaveType =
  | "ANNUAL"
  | "SICK"
  | "CASUAL"
  | "UNPAID"
  | "PARENTAL"
  | "OTHER";

export type LeaveStatus =
  | "PENDING_TEAM_LEAD"
  | "PENDING_HR"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED";

export type LeaveAction = "APPROVE" | "REJECT" | "CANCEL";

export interface LeaveUserSummary {
  id: string;
  name: string;
  email?: string | null;
  departmentId?: string | null;
}

/** A `leave_requests` row with its approver relations. */
export interface LeaveRequestRecord extends WorkspaceRecord {
  id: string;
  userId: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: LeaveStatus;
  currentStage: number;
  teamLeadId?: string | null;
  hodId?: string | null;
  hrApproverId?: string | null;
  decidedById?: string | null;
  decidedAt?: string | null;
  decisionNote?: string | null;
  submittedAt?: string | null;
  cancelledAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  user?: LeaveUserSummary | null;
  teamLead?: LeaveUserSummary | null;
  hod?: LeaveUserSummary | null;
  hrApprover?: LeaveUserSummary | null;
  decidedBy?: LeaveUserSummary | null;
}

export interface LeaveTimelineEntry {
  id: string;
  action: string;
  actorId: string | null;
  actorName: string;
  at: string;
  status: LeaveStatus | string | null;
  note: string | null;
  override: boolean;
}

export interface LeaveTimelineResponse {
  success: boolean;
  request: LeaveRequestRecord;
  timeline: LeaveTimelineEntry[];
}

export interface LeaveCreateInput {
  type: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
}

export interface LeaveTransitionInput {
  action: LeaveAction;
  note?: string;
}
