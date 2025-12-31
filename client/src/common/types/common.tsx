export interface ComponentProps {
  children: React.ReactElement;
}

export type UserInfo = Readonly<{
  id: string;
  username: string;
  email: string;
  status: string;
  firstname: string;
  lastname: string;
  specialty?: string | null | undefined;
  role?: string;
  referralCode?: string | null;
  meta?: any;
}>;
