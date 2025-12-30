// src/app/navigation/linking.ts
import { LinkingOptions } from '@react-navigation/native';

export const linking: LinkingOptions<any> = {
  prefixes: ['chavrutrail://', 'https://chavrutrail.app'],
  config: {
    screens: {
      FeedStack: {
        screens: {
          FeedList: 'feed',
          RideDetails: 'ride/:rideId',
        },
      },
      MyRidesStack: {
        screens: {
          MyRidesList: 'my-rides',
          RideDetails: 'ride/:rideId',
        },
      },
      ProfileStack: {
        screens: {
          Profile: 'profile',
          Settings: 'settings',
        },
      },
      CreateStack: {
        screens: {
          CreateRideWizard: 'create',
        },
      },
    },
  },
};