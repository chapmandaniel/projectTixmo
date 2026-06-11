import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import {
    AlertTriangle,
    CalendarDays,
    CreditCard,
    Loader,
    Lock,
    Mail,
    Minus,
    Plus,
    ShieldCheck,
    Ticket,
    User,
} from 'lucide-react';
import {
    DashboardButton,
    DashboardChip,
    DashboardSurface,
    DashboardTextInput,
} from '../components/dashboard/DashboardPrimitives';
import { api } from '../lib/api';
import { auth } from '../lib/auth';
import {
    getApiBaseUrl,
    getPaymentCurrency,
    getPolicyLinks,
    getStripePublishableKey,
} from '../lib/runtimeConfig';
import { cn } from '../lib/utils';

const formatMoney = (value, currency = 'usd') => {
    const amount = Number(value) || 0;
    return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: String(currency || 'usd').toUpperCase(),
    }).format(amount);
};

const formatDate = (value) => {
    if (!value) return 'Date to be announced';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Date to be announced';

    return date.toLocaleString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
};

const unwrapApiPayload = (response) => response?.data?.data || response?.data || response;

const getTicketPrice = (ticketType) => {
    const activeTier = ticketType?.tiers?.find((tier) => tier.isActive !== false);
    return Number(activeTier?.price ?? ticketType?.price ?? 0);
};

const buildInitialQuantities = (ticketTypes = []) => (
    ticketTypes.reduce((next, ticketType) => {
        next[ticketType.id] = 0;
        return next;
    }, {})
);

const PolicyLinks = ({ links, compact = false }) => (
    <div className={cn(
        'rounded-md border border-dashboard-border bg-dashboard-panelMuted text-dashboard-muted',
        compact ? 'px-4 py-3 text-xs leading-5' : 'px-4 py-4 text-sm leading-6'
    )}>
        By placing this order, you agree to the{' '}
        <a className="text-zinc-100 underline decoration-dashboard-accent/70 underline-offset-4" href={links.termsUrl} target="_blank" rel="noreferrer">
            Terms of Service
        </a>
        {' '}and acknowledge the{' '}
        <a className="text-zinc-100 underline decoration-dashboard-accent/70 underline-offset-4" href={links.refundPolicyUrl} target="_blank" rel="noreferrer">
            Refund Policy
        </a>
        {' '}and{' '}
        <a className="text-zinc-100 underline decoration-dashboard-accent/70 underline-offset-4" href={links.privacyPolicyUrl} target="_blank" rel="noreferrer">
            Privacy Policy
        </a>
        .
    </div>
);

const StripePaymentForm = ({ order, currency, returnUrl, onPaymentComplete }) => {
    const stripe = useStripe();
    const elements = useElements();
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!stripe || !elements) return;

        setSubmitting(true);
        setError('');

        const result = await stripe.confirmPayment({
            elements,
            confirmParams: {
                return_url: returnUrl,
            },
            redirect: 'if_required',
        });

        if (result.error) {
            setError(result.error.message || 'Payment could not be completed.');
            setSubmitting(false);
            return;
        }

        onPaymentComplete(result.paymentIntent || { status: 'submitted' });
        setSubmitting(false);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            <PaymentElement />
            {error ? (
                <div className="rounded-md border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm leading-6 text-rose-50">
                    {error}
                </div>
            ) : null}
            <DashboardButton isDark type="submit" disabled={!stripe || submitting} className="h-12 w-full">
                {submitting ? (
                    <>
                        <Loader className="h-4 w-4 animate-spin" />
                        Processing payment
                    </>
                ) : (
                    <>
                        Pay {formatMoney(order?.totalAmount, currency)}
                        <Lock className="h-4 w-4" />
                    </>
                )}
            </DashboardButton>
        </form>
    );
};

const BuyerAuthPanel = ({ currentUser, onAuthenticated }) => {
    const [mode, setMode] = useState('register');
    const [form, setForm] = useState({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    if (currentUser) {
        return (
            <DashboardSurface isDark accent="green" className="p-5">
                <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-md bg-dashboard-control text-emerald-200">
                        <User className="h-5 w-5" />
                    </span>
                    <div>
                        <p className="text-sm font-light text-zinc-100">
                            Signed in as {currentUser.email}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-dashboard-muted">
                            Tickets and receipt will be attached to this account.
                        </p>
                    </div>
                </div>
            </DashboardSurface>
        );
    }

    const handleChange = (key) => (event) => {
        setForm((current) => ({ ...current, [key]: event.target.value }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setLoading(true);
        setError('');

        try {
            const user = mode === 'register'
                ? await auth.register(form)
                : await auth.login(form.email, form.password);
            onAuthenticated(user);
        } catch (requestError) {
            setError(requestError.response?.data?.message || requestError.message || 'Could not authenticate this buyer.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <DashboardSurface isDark accent="blue" className="p-5">
            <div className="mb-5 flex rounded-md border border-dashboard-border bg-dashboard-panelMuted p-1">
                {['register', 'login'].map((option) => (
                    <button
                        key={option}
                        type="button"
                        onClick={() => setMode(option)}
                        className={cn(
                            'flex-1 rounded-md px-3 py-2 text-sm font-light transition',
                            mode === option
                                ? 'bg-dashboard-control text-zinc-100'
                                : 'text-dashboard-muted hover:text-zinc-100'
                        )}
                    >
                        {option === 'register' ? 'New buyer' : 'Sign in'}
                    </button>
                ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                {mode === 'register' ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                        <DashboardTextInput
                            isDark
                            aria-label="First name"
                            placeholder="First name"
                            value={form.firstName}
                            onChange={handleChange('firstName')}
                            required
                        />
                        <DashboardTextInput
                            isDark
                            aria-label="Last name"
                            placeholder="Last name"
                            value={form.lastName}
                            onChange={handleChange('lastName')}
                            required
                        />
                    </div>
                ) : null}
                <div className="relative">
                    <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-dashboard-subtleAlt" />
                    <DashboardTextInput
                        isDark
                        aria-label="Email address"
                        type="email"
                        className="pl-11"
                        placeholder="name@example.com"
                        value={form.email}
                        onChange={handleChange('email')}
                        required
                    />
                </div>
                <div className="relative">
                    <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-dashboard-subtleAlt" />
                    <DashboardTextInput
                        isDark
                        aria-label="Password"
                        type="password"
                        className="pl-11"
                        placeholder="Password"
                        value={form.password}
                        onChange={handleChange('password')}
                        minLength={8}
                        required
                    />
                </div>

                {error ? (
                    <div className="rounded-md border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm leading-6 text-rose-50">
                        {error}
                    </div>
                ) : null}

                <DashboardButton isDark type="submit" disabled={loading} className="h-11 w-full">
                    {loading ? (
                        <>
                            <Loader className="h-4 w-4 animate-spin" />
                            Continue
                        </>
                    ) : (
                        mode === 'register' ? 'Create buyer account' : 'Sign in for checkout'
                    )}
                </DashboardButton>
            </form>
        </DashboardSurface>
    );
};

const CheckoutPage = ({ user, onAuthenticated }) => {
    const { slug } = useParams();
    const [event, setEvent] = useState(null);
    const [quantities, setQuantities] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [order, setOrder] = useState(null);
    const [paymentSession, setPaymentSession] = useState(null);
    const [paymentComplete, setPaymentComplete] = useState(null);

    const policyLinks = useMemo(() => getPolicyLinks(), []);
    const stripePublishableKey = useMemo(() => getStripePublishableKey(), []);
    const paymentCurrency = useMemo(() => getPaymentCurrency(), []);
    const stripePromise = useMemo(
        () => (stripePublishableKey ? loadStripe(stripePublishableKey) : null),
        [stripePublishableKey]
    );

    useEffect(() => {
        let cancelled = false;

        const loadEvent = async () => {
            try {
                setLoading(true);
                setError('');
                const response = await fetch(`${getApiBaseUrl()}/events/public/${slug}`);
                const body = await response.json().catch(() => ({}));

                if (!response.ok) {
                    throw new Error(body.message || 'This event is not available for checkout.');
                }

                const payload = unwrapApiPayload(body);
                if (!cancelled) {
                    setEvent(payload);
                    setQuantities(buildInitialQuantities(payload.ticketTypes || []));
                }
            } catch (requestError) {
                if (!cancelled) {
                    setError(requestError.message || 'This event is not available for checkout.');
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        loadEvent();

        return () => {
            cancelled = true;
        };
    }, [slug]);

    const ticketTypes = event?.ticketTypes || [];
    const selectedItems = useMemo(() => (
        ticketTypes
            .map((ticketType) => ({
                ticketType,
                quantity: quantities[ticketType.id] || 0,
                price: getTicketPrice(ticketType),
            }))
            .filter((item) => item.quantity > 0)
    ), [quantities, ticketTypes]);
    const subtotal = selectedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const ticketCount = selectedItems.reduce((sum, item) => sum + item.quantity, 0);
    const hasPolicyLinks = Boolean(policyLinks.privacyPolicyUrl && policyLinks.termsUrl && policyLinks.refundPolicyUrl);
    const canPreparePayment = Boolean(user && selectedItems.length && hasPolicyLinks && (subtotal === 0 || stripePublishableKey));

    const setTicketQuantity = (ticketType, nextQuantity) => {
        const maxAllowed = Math.min(ticketType.maxPerOrder || 10, ticketType.quantityAvailable || 0);
        const quantity = Math.max(0, Math.min(maxAllowed, nextQuantity));
        setPaymentSession(null);
        setOrder(null);
        setPaymentComplete(null);
        setQuantities((current) => ({ ...current, [ticketType.id]: quantity }));
    };

    const handlePreparePayment = async () => {
        if (!canPreparePayment) return;
        setSubmitting(true);
        setError('');
        setPaymentSession(null);
        setPaymentComplete(null);

        try {
            const orderResponse = await api.post('/orders', {
                items: selectedItems.map((item) => ({
                    ticketTypeId: item.ticketType.id,
                    quantity: item.quantity,
                })),
            });
            const createdOrder = unwrapApiPayload(orderResponse);
            setOrder(createdOrder);

            if (Number(createdOrder.totalAmount || subtotal) <= 0) {
                setPaymentComplete({ status: 'free_order' });
                return;
            }

            const paymentResponse = await api.post('/payments/create-intent', {
                orderId: createdOrder.id,
            });
            setPaymentSession(unwrapApiPayload(paymentResponse));
        } catch (requestError) {
            setError(requestError.response?.data?.message || requestError.message || 'Checkout could not be prepared.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <main className="min-h-screen bg-dashboard-shell text-zinc-100">
                <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-5">
                    <div className="flex items-center gap-3 text-dashboard-muted">
                        <Loader className="h-5 w-5 animate-spin" />
                        Loading checkout...
                    </div>
                </div>
            </main>
        );
    }

    if (error && !event) {
        return (
            <main className="min-h-screen bg-dashboard-shell text-zinc-100">
                <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-5">
                    <DashboardSurface isDark accent="amber" className="p-6 text-center">
                        <AlertTriangle className="mx-auto h-8 w-8 text-amber-200" />
                        <h1 className="mt-4 text-2xl font-light tracking-tight">Checkout unavailable</h1>
                        <p className="mt-3 text-sm leading-6 text-dashboard-muted">{error}</p>
                    </DashboardSurface>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen overflow-x-hidden bg-dashboard-shell text-zinc-100 selection:bg-dashboard-accent/30">
            <div className="dashboard-radial dashboard-grid min-h-screen max-w-full overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8">
                <div
                    className="mx-auto grid min-w-0 w-full gap-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)]"
                    style={{ maxWidth: 'min(80rem, calc(100vw - 2rem))' }}
                >
                    <section className="min-w-0 space-y-5">
                        <DashboardSurface
                            isDark
                            accent="brand"
                            className="min-w-0 w-full p-6 sm:p-8"
                            style={{ maxWidth: 'calc(100vw - 2rem)' }}
                        >
                            <div className="flex flex-wrap items-center gap-2">
                                <DashboardChip isDark>Secure checkout</DashboardChip>
                                <DashboardChip isDark>{event?.organization?.name || 'Tixmo'}</DashboardChip>
                            </div>
                            <h1 className="mt-5 max-w-[18rem] break-words text-3xl font-light leading-tight tracking-tight text-zinc-100 sm:max-w-none sm:text-5xl">
                                {event?.name || 'Event checkout'}
                            </h1>
                            {event?.description ? (
                                <p className="mt-4 max-w-[18rem] break-words text-sm font-light leading-7 text-dashboard-muted sm:max-w-3xl">
                                    {event.description}
                                </p>
                            ) : null}
                            <div className="mt-6 grid gap-3 sm:grid-cols-2">
                                <div className="min-w-0 rounded-md border border-dashboard-border bg-dashboard-panelMuted p-4">
                                    <CalendarDays className="h-5 w-5 text-pink-300" />
                                    <p className="mt-3 break-words text-sm text-zinc-100">{formatDate(event?.startDatetime)}</p>
                                    <p className="mt-1 break-words text-xs text-dashboard-muted">{event?.timezone || 'Local venue time'}</p>
                                </div>
                                <div className="min-w-0 rounded-md border border-dashboard-border bg-dashboard-panelMuted p-4">
                                    <Ticket className="h-5 w-5 text-orange-300" />
                                    <p className="mt-3 break-words text-sm text-zinc-100">{event?.venue?.name || 'Venue to be announced'}</p>
                                    <p className="mt-1 break-words text-xs text-dashboard-muted">{event?.status === 'ON_SALE' ? 'On sale now' : 'Published event'}</p>
                                </div>
                            </div>
                        </DashboardSurface>

                        <DashboardSurface
                            isDark
                            accent="amber"
                            className="min-w-0 w-full p-5 sm:p-6"
                            style={{ maxWidth: 'calc(100vw - 2rem)' }}
                        >
                            <div className="mb-5 flex items-center justify-between gap-4">
                                <div className="min-w-0">
                                    <h2 className="text-2xl font-light tracking-tight">Choose tickets</h2>
                                    <p className="mt-2 max-w-[18rem] break-words text-sm leading-6 text-dashboard-muted sm:max-w-none">
                                        Pick the ticket mix for this order. Inventory is held after checkout starts.
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                {ticketTypes.length ? ticketTypes.map((ticketType) => {
                                    const price = getTicketPrice(ticketType);
                                    const quantity = quantities[ticketType.id] || 0;
                                    const maxAllowed = Math.min(ticketType.maxPerOrder || 10, ticketType.quantityAvailable || 0);

                                    return (
                                        <div key={ticketType.id} className="grid min-w-0 gap-4 rounded-md border border-dashboard-border bg-dashboard-panelMuted p-4 sm:grid-cols-[minmax(0,1fr)_160px] sm:items-center">
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <h3 className="break-words text-lg font-light text-zinc-100">{ticketType.name}</h3>
                                                    <span className="rounded-full border border-dashboard-borderStrong bg-dashboard-panelAlt px-2 py-0.5 text-[11px] text-dashboard-muted">
                                                        {ticketType.quantityAvailable || 0} left
                                                    </span>
                                                </div>
                                                <p className="mt-2 break-words text-sm text-dashboard-muted">{ticketType.description || 'General event admission.'}</p>
                                                <p className="mt-3 text-xl font-light text-zinc-100">{formatMoney(price, paymentCurrency)}</p>
                                            </div>
                                            <div className="flex h-12 items-center justify-between rounded-md border border-dashboard-border bg-dashboard-panel">
                                                <button
                                                    type="button"
                                                    aria-label={`Decrease ${ticketType.name}`}
                                                    onClick={() => setTicketQuantity(ticketType, quantity - 1)}
                                                    className="flex h-full w-12 items-center justify-center text-dashboard-muted transition hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
                                                    disabled={quantity <= 0}
                                                >
                                                    <Minus className="h-4 w-4" />
                                                </button>
                                                <span className="text-lg font-light">{quantity}</span>
                                                <button
                                                    type="button"
                                                    aria-label={`Increase ${ticketType.name}`}
                                                    onClick={() => setTicketQuantity(ticketType, quantity + 1)}
                                                    className="flex h-full w-12 items-center justify-center text-dashboard-muted transition hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
                                                    disabled={quantity >= maxAllowed}
                                                >
                                                    <Plus className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                }) : (
                                    <div className="rounded-md border border-dashboard-border bg-dashboard-panelMuted px-4 py-8 text-center text-sm text-dashboard-muted">
                                        No active ticket types are available for this event.
                                    </div>
                                )}
                            </div>
                        </DashboardSurface>
                    </section>

                    <aside className="min-w-0 space-y-5 lg:sticky lg:top-6 lg:self-start">
                        <BuyerAuthPanel currentUser={user} onAuthenticated={onAuthenticated} />

                        <DashboardSurface isDark accent="green" className="p-5 sm:p-6">
                            <div className="flex items-center gap-3">
                                <span className="flex h-11 w-11 items-center justify-center rounded-md bg-dashboard-control text-emerald-200">
                                    <CreditCard className="h-5 w-5" />
                                </span>
                                <div>
                                    <h2 className="text-2xl font-light tracking-tight">Order summary</h2>
                                    <p className="mt-1 text-xs text-dashboard-muted">{ticketCount} ticket{ticketCount === 1 ? '' : 's'} selected</p>
                                </div>
                            </div>

                            <div className="mt-5 space-y-3 border-y border-dashboard-border py-4">
                                {selectedItems.length ? selectedItems.map((item) => (
                                    <div key={item.ticketType.id} className="flex items-start justify-between gap-4 text-sm">
                                        <div>
                                            <p className="text-zinc-100">{item.ticketType.name}</p>
                                            <p className="mt-1 text-xs text-dashboard-muted">{item.quantity} x {formatMoney(item.price, paymentCurrency)}</p>
                                        </div>
                                        <p className="text-zinc-100">{formatMoney(item.price * item.quantity, paymentCurrency)}</p>
                                    </div>
                                )) : (
                                    <p className="text-sm text-dashboard-muted">Choose at least one ticket.</p>
                                )}
                            </div>

                            <div className="mt-5 flex items-center justify-between text-lg">
                                <span className="font-light text-dashboard-muted">Total</span>
                                <span className="font-light text-zinc-100">{formatMoney(subtotal, paymentCurrency)}</span>
                            </div>

                            <div className="mt-5 space-y-3">
                                {hasPolicyLinks ? (
                                    <PolicyLinks links={policyLinks} compact />
                                ) : (
                                    <div className="rounded-md border border-amber-300/20 bg-amber-400/10 px-4 py-3 text-sm leading-6 text-amber-50">
                                        Checkout is blocked until approved Terms, Refund Policy, and Privacy Policy URLs are configured.
                                    </div>
                                )}
                                {!stripePublishableKey && subtotal > 0 ? (
                                    <div className="rounded-md border border-amber-300/20 bg-amber-400/10 px-4 py-3 text-sm leading-6 text-amber-50">
                                        Checkout is blocked until the Stripe publishable key is configured.
                                    </div>
                                ) : null}
                                {error && event ? (
                                    <div className="rounded-md border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm leading-6 text-rose-50">
                                        {error}
                                    </div>
                                ) : null}
                                <DashboardButton
                                    isDark
                                    type="button"
                                    disabled={!canPreparePayment || submitting || Boolean(paymentSession)}
                                    onClick={handlePreparePayment}
                                    className="h-12 w-full"
                                >
                                    {submitting ? (
                                        <>
                                            <Loader className="h-4 w-4 animate-spin" />
                                            Preparing checkout
                                        </>
                                    ) : (
                                        <>
                                            Continue to secure payment
                                            <ShieldCheck className="h-4 w-4" />
                                        </>
                                    )}
                                </DashboardButton>
                            </div>

                            {paymentSession?.clientSecret && stripePromise ? (
                                <div className="mt-6 border-t border-dashboard-border pt-5">
                                    <Elements stripe={stripePromise} options={{ clientSecret: paymentSession.clientSecret }}>
                                        <StripePaymentForm
                                            order={order}
                                            currency={paymentCurrency}
                                            returnUrl={`${window.location.origin}/checkout/${slug}?orderId=${order?.id || ''}`}
                                            onPaymentComplete={setPaymentComplete}
                                        />
                                    </Elements>
                                </div>
                            ) : null}

                            {paymentComplete ? (
                                <div className="mt-5 rounded-md border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm leading-6 text-emerald-50">
                                    {paymentComplete.status === 'free_order'
                                        ? 'Order reserved. Your tickets are being confirmed.'
                                        : 'Payment received. Your order is being confirmed.'}
                                </div>
                            ) : null}
                        </DashboardSurface>
                    </aside>
                </div>
            </div>
        </main>
    );
};

export default CheckoutPage;
