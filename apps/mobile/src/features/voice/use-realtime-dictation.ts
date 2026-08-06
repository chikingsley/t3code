import { AudioModule, setAudioModeAsync, useAudioStream } from "expo-audio";
import * as React from "react";
import { Alert } from "react-native";

import {
  type DictationPhase,
  dictationSessionCoordinator,
  isDictationBusy,
  isDictationCapturing,
} from "./dictation-session";
import { RealtimeTranscriber } from "./realtime-transcriber";
import { voiceConfig } from "./voice-config";

const SAMPLE_RATE = 16_000;

export interface DictationResult {
  readonly error: string | null;
  readonly text: string;
}

export function useRealtimeDictation() {
  const [phase, setPhase] = React.useState<DictationPhase>("idle");
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [finalText, setFinalText] = React.useState("");
  const [interimText, setInterimText] = React.useState("");
  const ownerRef = React.useRef(Symbol("mobile-dictation"));
  const transcriberRef = React.useRef<RealtimeTranscriber | null>(null);
  const finalRef = React.useRef("");
  const interimRef = React.useRef("");

  const { stream } = useAudioStream({
    channels: 1,
    encoding: "int16",
    onBuffer: (buffer) => {
      transcriberRef.current?.feed(buffer.data, buffer.sampleRate);
    },
    sampleRate: SAMPLE_RATE,
  });

  const releaseCapture = React.useCallback(async () => {
    try {
      stream.stop();
    } catch {
      // Expo can release the native shared object before React cleanup runs.
    }
    await setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
    dictationSessionCoordinator.release(ownerRef.current);
  }, [stream]);

  const fail = React.useCallback(
    async (message: string) => {
      transcriberRef.current?.cancel();
      transcriberRef.current = null;
      await releaseCapture();
      setErrorMessage(message);
      setPhase("failed");
    },
    [releaseCapture],
  );

  const start = React.useCallback(async (): Promise<string | null> => {
    if (!dictationSessionCoordinator.claim(ownerRef.current)) {
      return "Another dictation session is already using the microphone.";
    }
    setErrorMessage(null);
    setPhase("requesting_permission");
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        dictationSessionCoordinator.release(ownerRef.current);
        setPhase("idle");
        Alert.alert("Microphone access needed", "Enable microphone access in Settings to dictate.");
        return null;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      finalRef.current = "";
      interimRef.current = "";
      setFinalText("");
      setInterimText("");
      transcriberRef.current = new RealtimeTranscriber(
        {
          onError: (message) => {
            void fail(message);
          },
          onOpen: () => setPhase("recording"),
          onTranscript: (text, isFinal) => {
            if (isFinal) {
              finalRef.current = finalRef.current ? `${finalRef.current} ${text}` : text;
              interimRef.current = "";
              setFinalText(finalRef.current);
              setInterimText("");
              return;
            }
            interimRef.current = text;
            setInterimText(text);
          },
        },
        voiceConfig(),
      );
      setPhase("connecting");
      await stream.start();
      return null;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Dictation failed to start.";
      await fail(message);
      return message;
    }
  }, [fail, stream]);

  const stop = React.useCallback(async (): Promise<DictationResult> => {
    setPhase("processing");
    await releaseCapture();
    const transcriber = transcriberRef.current;
    transcriberRef.current = null;
    try {
      const completed = await transcriber?.stop();
      const text = (completed?.text || finalRef.current || interimRef.current).trim();
      if (completed?.error) {
        setErrorMessage(completed.error);
        setPhase("failed");
        return { error: completed.error, text: "" };
      }
      if (!text) {
        const message = "No speech was detected. Tap the microphone and try again.";
        setErrorMessage(message);
        setPhase("failed");
        return { error: message, text: "" };
      }
      setErrorMessage(null);
      setPhase("idle");
      return { error: null, text };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Dictation failed to finish.";
      setErrorMessage(message);
      setPhase("failed");
      return { error: message, text: "" };
    }
  }, [releaseCapture]);

  React.useEffect(
    () => () => {
      transcriberRef.current?.cancel();
      transcriberRef.current = null;
      void releaseCapture();
    },
    [releaseCapture],
  );

  const liveText = interimText ? `${finalText} ${interimText}`.trim() : finalText;

  return {
    errorMessage,
    isBusy: isDictationBusy(phase),
    isRecording: isDictationCapturing(phase),
    liveText,
    phase,
    start,
    stop,
  };
}
