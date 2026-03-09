import {
    AlertTriangle,
    CheckCircle2,
    Clock3,
    RefreshCcw,
    XCircle,
} from 'lucide-react';

export const APPROVAL_STATUS_META = {
    PENDING_REVIEW: {
        label: 'Pending Review',
        chip: 'bg-amber-500/15 text-amber-200 border border-amber-400/30',
        icon: Clock3,
    },
    CHANGES_REQUESTED: {
        label: 'Changes Requested',
        chip: 'bg-orange-500/15 text-orange-200 border border-orange-400/30',
        icon: AlertTriangle,
    },
    UPDATED: {
        label: 'Updated',
        chip: 'bg-sky-500/15 text-sky-200 border border-sky-400/30',
        icon: RefreshCcw,
    },
    APPROVED: {
        label: 'Approved',
        chip: 'bg-emerald-500/15 text-emerald-200 border border-emerald-400/30',
        icon: CheckCircle2,
    },
    DECLINED: {
        label: 'Declined',
        chip: 'bg-rose-500/15 text-rose-200 border border-rose-400/30',
        icon: XCircle,
    },
};

export const APPROVAL_STATUS_OPTIONS = [
    'PENDING_REVIEW',
    'UPDATED',
    'CHANGES_REQUESTED',
    'APPROVED',
    'DECLINED',
];

export const DECISION_OPTIONS = [
    { value: 'APPROVED', label: 'Approve' },
    { value: 'CHANGES_REQUESTED', label: 'Request Changes' },
    { value: 'DECLINED', label: 'Decline' },
];

export const formatApprovalDate = (value) => {
    if (!value) {
        return 'Not set';
    }

    return new Date(value).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
};
