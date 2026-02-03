// src/app/navigation/linking.ts
import { LinkingOptions, getStateFromPath } from '@react-navigation/native';

const config = {
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
    NavigationStack: {
      screens: {
        NavigationMain: 'navigation',
      },
    },
  },
};

export const linking: LinkingOptions<any> = {
  prefixes: [
    'bishvil://',
    'https://bishvil.app',
    'https://bishvil-app.vercel.app'
  ],
  config,
  // Custom state builder to ensure FeedList is in stack when deep linking to RideDetails
  getStateFromPath: (path, options) => {
    const state = getStateFromPath(path, options ?? config);
    if (!state) return state;

    // Find FeedStack route
    const feedStackRoute = state.routes.find((r: any) => r.name === 'FeedStack');
    if (feedStackRoute?.state?.routes) {
      const routes = feedStackRoute.state.routes;
      // If RideDetails is the only screen, prepend FeedList
      if (routes.length === 1 && routes[0].name === 'RideDetails') {
        feedStackRoute.state = {
          ...feedStackRoute.state,
          routes: [
            { name: 'FeedList' },
            ...routes,
          ],
          index: 1, // Focus on RideDetails (second screen)
        };
      }
    }

    return state;
  },
};
