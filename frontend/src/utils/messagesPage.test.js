import { describe, expect, it } from "vitest";
import { filterConversationsBySearch } from "./messagesPage";

describe("messages page helpers", () => {
  it("filters conversations by search text", () => {
    const conversations = [
      {
        title: "Ava Chen",
        subtitle: "Let’s review the lesson plan",
        role: "Mentor",
      },
      {
        title: "Noah Patel",
        subtitle: "How’s your project going?",
        role: "Learner",
      },
    ];

    expect(filterConversationsBySearch(conversations, "ava")).toHaveLength(1);
    expect(filterConversationsBySearch(conversations, "project")).toHaveLength(
      1,
    );
  });
});
