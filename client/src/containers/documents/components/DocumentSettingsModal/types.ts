export interface TableInfo {
  tableName: string;
  columns: Array<{
    name: string;
    type: string;
    nullable: boolean;
    defaultValue: string | null;
    allowedValues?: string[]; // enum labels or CHECK constraint allowed values
  }>;
}

export interface TableColumn {
  title: string;
  dataIndex: string;
  key: string;
  width?: number;
  minWidth?: number;
  ellipsis?: boolean | { showTitle: boolean };
  render?: (text: any, record: any, index: number) => React.ReactNode;
}

export interface TableRecord {
  id?: string | number;
  [key: string]: any;
}

export interface DomainConfig {
  configuredBy: 'CNAME' | 'A' | 'http' | 'dns-01' | null;
  acceptedChallenges: string[];
  misconfigured: boolean;
  recommendedIps: string[];
  recommendedCname: string;
}

export interface Domain {
  name: string;
  apexName: string;
  verified: boolean;
  createdAt: number;
  config: DomainConfig;
  isApex: boolean;
  dnsRecord: {
    type: string;
    name: string;
    value: string;
  };
  verificationRecord?: {
    type: string;
    name: string;
    value: string;
  } | null;
  redirect?: string;
  redirectStatusCode?: number;
  removalError?: string;
}

export interface DocumentSettingsModalProps {
  open: boolean;
  onClose: () => void;
  initialDoc?: any; // Document object from parent
  deployDocId?: string;
  isReadOnly?: boolean;
  isCustomDomainLocked?: boolean;
  initialActiveTab?: string; // Initial tab to show when modal opens
  onTriggerRedeployment?: () => void; // Callback to trigger redeployment in parent component
  onSyncFiles?: (
    files: Array<{ path: string; content: string; type: 'file' }>
  ) => void; // Sync latest files to editor before redeploy
  onDocumentUpdated?: (updatedDoc: any) => void; // Callback to notify parent of document updates with latest server data
}
