import * as React from "react";
import { useSharedValue } from "react-native-reanimated";

import {
  type DictationPhase,
  dictationSessionCoordinator,
  isDictationBusy,
  isDictationCapturing,
} from "./dictation-session";
import { RealtimeTranscriber } from "./realtime-transcriber";
import { voiceConfig } from "./voice-config";
import { appendWaveformLevel, pcmInt16Level } from "./waveform-levels";

const TARGET_SAMPLE_RATE = 16_000;

export interface DictationResult {
  readonly error: string | null;
  readonly text: string;
}

function resampleToPcm16(input: Float32Array, sourceSampleRate: number): ArrayBuffer {
  const ratio = sourceSampleRate / TARGET_SAMPLE_RATE;
  const outputLength = Math.max(1, Math.floor(input.length / ratio));
  const output = new Int16Array(outputLength);

  for (let outputIndex = 0; outputIndex < outputLength; outputIndex += 1) {
    const start = Math.floor(outputIndex * ratio);
    const end = Math.max(start + 1, Math.min(input.length, Math.floor((outputIndex + 1) * ratio)));
    let sum = 0;
    for (let inputIndex = start; inputIndex < end; inputIndex += 1) {
      sum += input[inputIndex] ?? 0;
    }
    const sample = Math.max(-1, Math.min(1, sum / (end - start)));
    output[outputIndex] = sample < 0 ? sample * 32_768 : sample * 32_767;
  }

  return output.buffer;
}

export function useRealtimeDictation() {
  const [phase, setPhase] = React.useState<DictationPhase>("idle");
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [finalText, setFinalText] = React.useState("");
  const [interimText, setInterimText] = React.useState("");
  const [startedAt, setStartedAt] = React.useState<number | null>(null);
  const ownerRef = React.useRef(Symbol("mobile-web-dictation"));
  const transcriberRef = React.useRef<RealtimeTranscriber | null>(null);
  const mediaStreamRef = React.useRef<MediaStream | null>(null);
  const audioContextRef = React.useRef<AudioContext | null>(null);
  const sourceNodeRef = React.useRef<MediaStreamAudioSourceNode | null>(null);
  const processorNodeRef = React.useRef<ScriptProcessorNode | null>(null);
  const silentGainRef = React.useRef<GainNode | null>(null);
  const finalRef = React.useRef("");
  const interimRef = React.useRef("");
  const waveformLevels = useSharedValue<ReadonlyArray<number>>([]);

  const releaseCapture = React.useCallback(async () => {
    processorNodeRef.current?.disconnect();
    sourceNodeRef.current?.disconnect();
    silentGainRef.current?.disconnect();
    processorNodeRef.current = null;
    sourceNodeRef.current = null;
    silentGainRef.current = null;
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    const context = audioContextRef.current;
    audioContextRef.current = null;
    if (context && context.state !== "closed") await context.close().catch(() => undefined);
    dictationSessionCoordinator.release(ownerRef.current);
  }, []);

  const fail = React.useCallback(
    async (message: string) => {
      transcriberRef.current?.cancel();
      transcriberRef.current = null;
      await releaseCapture();
      setStartedAt(null);
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
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("This browser does not provide microphone capture.");
      }
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      mediaStreamRef.current = mediaStream;
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      await audioContext.resume();

      finalRef.current = "";
      interimRef.current = "";
      setFinalText("");
      setInterimText("");
      waveformLevels.value = [];
      transcriberRef.current = new RealtimeTranscriber(
        {
          onError: (message) => void fail(message),
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

      const source = audioContext.createMediaStreamSource(mediaStream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      const silentGain = audioContext.createGain();
      silentGain.gain.value = 0;
      processor.onaudioprocess = (event) => {
        const pcm = resampleToPcm16(event.inputBuffer.getChannelData(0), audioContext.sampleRate);
        transcriberRef.current?.feed(pcm, TARGET_SAMPLE_RATE);
        waveformLevels.value = appendWaveformLevel(waveformLevels.value, pcmInt16Level(pcm));
      };
      source.connect(processor);
      processor.connect(silentGain);
      silentGain.connect(audioContext.destination);
      sourceNodeRef.current = source;
      processorNodeRef.current = processor;
      silentGainRef.current = silentGain;
      setPhase("connecting");
      setStartedAt(Date.now());
      return null;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Dictation failed to start.";
      await fail(message);
      return message;
    }
  }, [fail, waveformLevels]);

  const stop = React.useCallback(async (): Promise<DictationResult> => {
    setPhase("processing");
    setStartedAt(null);
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
    startedAt,
    stop,
    waveformLevels,
  };
}
