import React from 'react';
import { Ticket } from 'lucide-react';
import { Link } from 'react-router-dom';
import './storefront.css';

export const StorefrontBrand = ({ href, to }) => {
    const content = (
        <>
            <Ticket size={27} strokeWidth={2.2} aria-hidden="true" />
            <span>
                tixmo<span className="sf-brand-dot">.</span>
            </span>
        </>
    );
    return to ? (
        <Link className="sf-brand" to={to} aria-label="Tixmo">
            {content}
        </Link>
    ) : (
        <a className="sf-brand" href={href || '#event-top'} aria-label="Tixmo">
            {content}
        </a>
    );
};

export const StorefrontButton = ({ children, className = '', ...props }) => (
    <button type="button" className={`sf-button ${className}`} {...props}>
        {children}
    </button>
);

export const StorefrontFact = ({ icon: Icon, label, children }) => (
    <div className="sf-fact">
        <Icon size={21} aria-hidden="true" />
        <div>
            <span className="sf-eyebrow">{label}</span>
            <div>{children}</div>
        </div>
    </div>
);
