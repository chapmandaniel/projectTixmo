import React from 'react';
import { DashboardEmptyState, DashboardSection } from '../../../components/dashboard/DashboardPrimitives';

export const PrototypeStubView = ({ isDark, title, description }) => (
    <DashboardSection isDark={isDark} accent="slate" title={title} description={description}>
        <DashboardEmptyState
            isDark={isDark}
            title="View scaffold"
            description="This route is wired on mock data. The remaining report body lands in the next prototype pass."
        />
    </DashboardSection>
);
