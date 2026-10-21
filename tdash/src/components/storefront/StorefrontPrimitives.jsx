import React from 'react';
import { Link } from 'react-router-dom';
import './storefront.css';

export const StorefrontBrand = ({ href, to }) => {
    const content = (
        <img
            className="sf-logo"
            src="/images/tixmo_logo.png"
            width={882}
            height={350}
            alt="Tixmo"
        />
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
