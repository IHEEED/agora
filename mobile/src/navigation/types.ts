import type { Community } from '../lib/types';

export type RootStackParamList = {
  MainTabs: undefined;
  Community: { community: Community };
  Post: { postId: string };
  Login: undefined;
  CreateCommunity: undefined;
  CreatePost: { communityId: string };
  Messages: undefined;
  Chat: { userId: string; username: string };
  Notifications: undefined;
  Settings: undefined;
  ProfileEdit: undefined;
};

export type TabParamList = {
  Feed: undefined;
  Communities: undefined;
  MessagesTab: undefined;
  Profile: undefined;
};
