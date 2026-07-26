import type { Community } from '../lib/types';

export type RootStackParamList = {
  MainTabs: undefined;
  Community: { community: Community };
  Post: { postId: string };
  Login: undefined;
  CreateCommunity: undefined;
  CreatePost: { communityId: string };
};

export type TabParamList = {
  Communities: undefined;
  Feed: undefined;
  Profile: undefined;
};
