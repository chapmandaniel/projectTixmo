import React from 'react';
import { Link } from 'react-router-dom';
import { ResponsivePie } from '@nivo/pie';
import { DashboardSection, DashboardStat } from '../../../components/dashboard/DashboardPrimitives';
import { getDashboardTheme } from '../../../lib/dashboardTheme';
import { cn } from '../../../lib/utils';
import { COMMUNITY } from '../mockData';
import { formatPercent } from '../formatters';
import { getChartTheme } from '../chartTheme';

export const CommunityView = ({ isDark, href }) => {
    const theme = getDashboardTheme(isDark);
    const pieData = [
        { id: 'positive', label: 'Positive', value: COMMUNITY.positive, color: '#10b981' },
        { id: 'neutral', label: 'Neutral', value: COMMUNITY.neutral, color: '#64748b' },
        { id: 'negative', label: 'Negative', value: COMMUNITY.negative, color: '#f43f5e' },
        { id: 'mixed', label: 'Mixed', value: COMMUNITY.mixed, color: '#f59e0b' },
    ];

    return (
        <div className="space-y-6">
            <DashboardSection isDark={isDark} accent="green" title="Conversation volume" description="Incoming comments, replies, messages and mentions on owned demo profiles for the selected 28 days.">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <DashboardStat isDark={isDark} label="Comments" value={String(COMMUNITY.incomingComments)} />
                    <DashboardStat isDark={isDark} label="Messages" value={String(COMMUNITY.incomingMessages)} />
                    <DashboardStat isDark={isDark} label="Mentions" value={String(COMMUNITY.incomingMentions)} />
                    <DashboardStat isDark={isDark} label="Open questions" value={String(COMMUNITY.openQuestions)} />
                </div>
            </DashboardSection>

            <DashboardSection isDark={isDark} accent="brand" title="Audience feedback" description="Eligible, classified and unclassified totals. Positive share uses classified comments as the denominator.">
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
                    <div className="h-[240px]">
                        <ResponsivePie
                            data={pieData}
                            theme={getChartTheme(isDark)}
                            colors={{ datum: 'data.color' }}
                            innerRadius={0.55}
                            padAngle={1.5}
                            cornerRadius={3}
                            enableArcLabels={false}
                            margin={{ top: 12, right: 12, bottom: 12, left: 12 }}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <DashboardStat isDark={isDark} label="Eligible" value={String(COMMUNITY.eligibleComments)} />
                        <DashboardStat isDark={isDark} label="Classified" value={String(COMMUNITY.classified)} detail={formatPercent((COMMUNITY.classified / COMMUNITY.eligibleComments) * 100, 0)} />
                        <DashboardStat isDark={isDark} label="Unclassified" value={String(COMMUNITY.unclassified)} />
                        <DashboardStat isDark={isDark} label="Positive share" value={formatPercent((COMMUNITY.positive / COMMUNITY.classified) * 100, 0)} />
                    </div>
                </div>
                <p className={cn('mt-4 text-sm font-light', theme.textSecondary)}>
                    Top praise: colour / lineup. Top criticism: merch stock. Recurring questions: sizing, tickets, accessibility.
                </p>
                <Link to={href('posts/ig-reel-aurora')} className="mt-2 inline-block text-sm text-pink-400">Open supporting comments</Link>
            </DashboardSection>

            <DashboardSection isDark={isDark} accent="amber" title="Responsiveness" description={`Observation cutoff ${COMMUNITY.observationCutoff}. ${COMMUNITY.businessHours}`}>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <DashboardStat isDark={isDark} label="Eligible conversations" value={String(COMMUNITY.eligibleConversations)} />
                    <DashboardStat isDark={isDark} label="Response rate" value={formatPercent(COMMUNITY.responseRate, 0)} detail={`${COMMUNITY.respondedConversations} replied`} />
                    <DashboardStat isDark={isDark} label="Median first reply" value={`${COMMUNITY.medianFirstReplyMinutes}m`} />
                    <DashboardStat isDark={isDark} label="90th percentile" value={`${COMMUNITY.p90FirstReplyMinutes}m`} />
                </div>
            </DashboardSection>

            <DashboardSection isDark={isDark} accent="slate" title="Resolution" description="Open and recurring unresolved topics from the mock community workflow.">
                <ul className={cn('list-disc space-y-1 pl-5 text-sm', theme.textSecondary)}>
                    {COMMUNITY.unresolvedTopics.map((topic) => <li key={topic}>{topic}</li>)}
                </ul>
            </DashboardSection>
        </div>
    );
};
