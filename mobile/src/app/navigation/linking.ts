// src/app/navigation/linking.ts
import { LinkingOptions } from '@react-navigation/native';

export const linking: LinkingOptions<any> = {
  prefixes: [
    'bishvil://', 
    'https://bishvil.app',
    'https://bishvil-app.vercel.app' // ADD THIS LINE
  ],
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
          RideDetails: 'my-rides/ride/:rideId',
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