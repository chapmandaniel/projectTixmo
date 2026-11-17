import React from 'react';
import { MooseChat as MooseChatCard } from '../../../components/dashboard/MooseChat';
import { answerMooseQuestion, SUGGESTED_QUESTIONS } from '../mooseAnswers';

export const MooseChat = ({ isDark, dashboard, typingDelay }) => (
    <MooseChatCard
        isDark={isDark}
        data={dashboard}
        askQuestion={answerMooseQuestion}
        suggestions={SUGGESTED_QUESTIONS}
        welcomeText={`Hi, I'm Moose, Tixmo's AI assistant. Ask me about the numbers on this page for ${dashboard.pageName}.`}
        resetKey={`${dashboard.pageId}:${dashboard.range}`}
        typingDelay={typingDelay}
    />
);

export default MooseChat;
