import type { ApprovalRequestId } from "@t3tools/contracts";
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";

import { AppText as Text, AppTextInput as TextInput } from "../../components/AppText";
import { cn } from "../../lib/cn";
import type { PendingUserInput, PendingUserInputDraftAnswer } from "../../lib/threadActivity";

export interface PendingUserInputCardProps {
  readonly pendingUserInput: PendingUserInput;
  readonly drafts: Record<string, PendingUserInputDraftAnswer>;
  readonly answers: Record<string, string | ReadonlyArray<string>> | null;
  readonly respondingUserInputId: ApprovalRequestId | null;
  readonly onSelectOption: (
    requestId: ApprovalRequestId,
    questionId: string,
    label: string,
  ) => void;
  readonly onChangeCustomAnswer: (
    requestId: ApprovalRequestId,
    questionId: string,
    customAnswer: string,
  ) => void;
  readonly onSubmit: () => Promise<unknown>;
  readonly onReject: () => Promise<unknown>;
}

export function PendingUserInputCard(props: PendingUserInputCardProps) {
  const [questionIndex, setQuestionIndex] = useState(0);
  const questions = props.pendingUserInput.questions;
  const question = questions[Math.min(questionIndex, questions.length - 1)];
  useEffect(() => setQuestionIndex(0), [props.pendingUserInput.requestId]);
  if (!question) return null;
  const draft = props.drafts[question.id];
  const selectedLabels = draft?.selectedOptionLabels ?? [];
  const busy = props.respondingUserInputId === props.pendingUserInput.requestId;
  const lastQuestion = questionIndex === questions.length - 1;

  return (
    <View className="gap-2.5 rounded-[20px] border border-neutral-200 bg-neutral-100/80 p-4 dark:border-white/6 dark:bg-neutral-900/80">
      <View className="flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1 gap-1">
          <Text className="font-t3-bold text-2xs uppercase tracking-[1.1px] text-sky-700 dark:text-sky-300">
            {questionIndex + 1} of {questions.length} · {question.header}
          </Text>
          <Text className="font-t3-bold text-lg text-neutral-950 dark:text-neutral-50">
            {question.question}
          </Text>
        </View>
        <Pressable
          accessibilityLabel="Decline question request"
          className="size-11 items-center justify-center rounded-full bg-white dark:bg-neutral-950/70"
          disabled={busy}
          onPress={() => void props.onReject()}
        >
          <Text className="text-xl text-neutral-600 dark:text-neutral-300">×</Text>
        </Pressable>
      </View>
      <View className="gap-2 pt-1">
        <Text className="font-t3-bold text-xs uppercase tracking-[1px] text-neutral-500 dark:text-neutral-500">
          {question.multiSelect ? "Choose one or more" : "Choose one"}
        </Text>
        <View className="gap-2.5">
          {question.options.map((option) => {
            const selected = selectedLabels.includes(option.label) && !draft?.customAnswer?.trim();
            return (
              <Pressable
                key={option.label}
                className={cn(
                  "flex-row items-center gap-3 rounded-2xl border px-3 py-3",
                  selected
                    ? "border-blue-300/50 bg-blue-50 dark:border-blue-400/28 dark:bg-blue-400/14"
                    : "border-neutral-200 bg-white dark:border-white/6 dark:bg-neutral-950/70",
                )}
                onPress={() =>
                  props.onSelectOption(props.pendingUserInput.requestId, question.id, option.label)
                }
              >
                <View
                  className={cn(
                    "size-[18px] items-center justify-center border",
                    question.multiSelect ? "rounded-md" : "rounded-full",
                    selected ? "border-sky-600 bg-sky-600" : "border-neutral-400",
                  )}
                >
                  {selected ? <View className="size-2 rounded-full bg-white" /> : null}
                </View>
                <View className="min-w-0 flex-1">
                  <Text className="font-t3-bold text-sm text-neutral-900 dark:text-neutral-100">
                    {option.label}
                  </Text>
                  <Text className="text-xs text-neutral-500 dark:text-neutral-400">
                    {option.description}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
        <TextInput
          value={draft?.customAnswer ?? ""}
          onChangeText={(value) =>
            props.onChangeCustomAnswer(props.pendingUserInput.requestId, question.id, value)
          }
          placeholder="Or type a custom answer"
          className="min-h-[54px] rounded-2xl border border-neutral-200 bg-white px-3.5 py-3 font-sans text-base text-neutral-950 dark:border-white/8 dark:bg-neutral-950/70 dark:text-neutral-50"
        />
      </View>
      <View className="flex-row items-center justify-between gap-3">
        <Pressable
          className="min-h-11 justify-center px-2"
          disabled={questionIndex === 0 || busy}
          onPress={() => setQuestionIndex((value) => Math.max(0, value - 1))}
        >
          <Text
            className={cn(
              "font-t3-bold text-sm",
              questionIndex === 0 ? "text-neutral-400" : "text-neutral-700 dark:text-neutral-200",
            )}
          >
            Previous
          </Text>
        </Pressable>
        <Pressable
          className={cn(
            "min-h-11 min-w-32 items-center justify-center rounded-2xl px-4",
            lastQuestion && props.answers
              ? "bg-blue-500"
              : !lastQuestion
                ? "bg-neutral-900 dark:bg-white"
                : "bg-neutral-200 dark:bg-neutral-700/60",
          )}
          disabled={(lastQuestion && props.answers === null) || busy}
          onPress={() =>
            lastQuestion
              ? void props.onSubmit()
              : setQuestionIndex((value) => Math.min(questions.length - 1, value + 1))
          }
        >
          <Text
            className={cn(
              "font-t3-extrabold text-sm",
              !lastQuestion ? "text-white dark:text-neutral-900" : "text-white",
            )}
          >
            {lastQuestion ? "Submit answers" : "Continue"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
