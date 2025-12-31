// Shared types for starter app user management

export interface StarterUser {
  id: string;
  name: string;
  email: string;
  created_at?: string;
  updated_at?: string;
}

export interface CreateUserRequest {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface UsersListResponse {
  success: boolean;
  data: {
    users: StarterUser[];
  };
}

export interface CreateUserResponse {
  success: boolean;
  data: {
    user: StarterUser;
  };
}


