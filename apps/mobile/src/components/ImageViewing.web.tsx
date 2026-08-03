import { Image, Modal, Pressable, View } from "react-native";

import { SymbolView } from "./AppSymbol";

export default function ImageViewing(props: {
  readonly images: ReadonlyArray<{
    readonly headers?: Record<string, string>;
    readonly uri: string;
  }>;
  readonly imageIndex: number;
  readonly visible: boolean;
  readonly onRequestClose: () => void;
  readonly doubleTapToZoomEnabled?: boolean;
  readonly swipeToCloseEnabled?: boolean;
}) {
  const image = props.images[props.imageIndex];

  return (
    <Modal
      animationType="fade"
      onRequestClose={props.onRequestClose}
      transparent
      visible={props.visible && image !== undefined}
    >
      <View className="flex-1 items-center justify-center bg-black/90 p-6">
        <Pressable
          accessibilityLabel="Close image preview"
          accessibilityRole="button"
          className="absolute right-5 top-5 z-10 h-11 w-11 items-center justify-center rounded-full bg-white/15"
          onPress={props.onRequestClose}
        >
          <SymbolView name="xmark" size={18} tintColor="#ffffff" type="monochrome" />
        </Pressable>
        {image ? (
          <Image
            accessibilityLabel="Image preview"
            resizeMode="contain"
            source={{ headers: image.headers, uri: image.uri }}
            className="h-full w-full"
          />
        ) : null}
      </View>
    </Modal>
  );
}
