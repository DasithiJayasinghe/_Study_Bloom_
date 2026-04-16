export type HelpRequestStatus = 'open' | 'accepted' | 'resolved' | 'deleted';

export interface RequestUser {
  _id: string;
  fullName: string;
  email: string;
  profilePicture: string | null;
}

export interface RequestFolder {
  _id: string;
  name: string;
}

export interface HelpRequest {
  _id: string;
  user: RequestUser;
  subject: string;
  questionTitle: string;
  questionDetails: string;
  attachments: string[];
  folder: RequestFolder | null;
  isUrgent: boolean;
  status: HelpRequestStatus;
  acceptedBy: RequestUser | null;
  createdAt: string;
  updatedAt: string;
}