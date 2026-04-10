export type ReportType =
  | 'maintenance'
  | 'repair'
  | 'material-delivery'
  | 'material-turnover'
  | 'training'
  | 'jobsite-progress'
  | 'time-sheets'
  | 'accident'
  | 'photo-upload';

export interface SubmissionRecord {
  id: string;
  created_at: string;
  updated_at: string;
  report_type: ReportType;
  date: string;
  job_name: string;
  job_number: string;
  technician_name: string;
  form_data: Record<string, unknown>;
  photo_urls: string[];
  signature_urls: string[];
  status: 'new' | 'submitted' | 'reviewed' | 'archived';
  notes: string | null;
  edited_by: string | null;
  edited_at: string | null;
  claimed_by: string | null;
}
