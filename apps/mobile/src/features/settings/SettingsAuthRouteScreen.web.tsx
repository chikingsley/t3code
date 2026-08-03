import { useAuth } from "@clerk/expo";
import { SignIn, UserProfile } from "@clerk/expo/web";
import { StackActions, useNavigation } from "@react-navigation/native";
import { useEffect } from "react";
import { ScrollView, View } from "react-native";

import { NativeStackScreenOptions } from "../../native/StackHeader";
import { hasCloudPublicConfig } from "../cloud/publicConfig";

export function SettingsAuthRouteScreen() {
  const navigation = useNavigation();

  useEffect(() => {
    if (!hasCloudPublicConfig()) {
      navigation.dispatch(StackActions.replace("Settings"));
    }
  }, [navigation]);

  return hasCloudPublicConfig() ? <ConfiguredSettingsAuthRouteScreen /> : null;
}

function ConfiguredSettingsAuthRouteScreen() {
  const { isLoaded, isSignedIn } = useAuth({ treatPendingAsSignedOut: false });

  return (
    <>
      <NativeStackScreenOptions options={{ title: isSignedIn ? "Account" : "Sign in" }} />
      <ScrollView
        className="flex-1 bg-sheet"
        contentContainerStyle={{ alignItems: "center", paddingHorizontal: 20, paddingVertical: 24 }}
      >
        {isLoaded ? (
          <View collapsable={false} className="w-full max-w-[480px] items-center">
            {isSignedIn ? <UserProfile routing="hash" /> : <SignIn routing="hash" />}
          </View>
        ) : null}
      </ScrollView>
    </>
  );
}
