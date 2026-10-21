import React from 'react';
import {createRoot} from 'react-dom/client';
import EventStudio from './src/features/EventStudio';
const fixture=window.__TASK305;
const response=await fetch('/api/v1/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:fixture.email,password:fixture.password})});
if(response.status!==200)throw Error('Real operator login failed');
localStorage.setItem('access_token',(await response.json()).data.accessToken);
const item=fixture.cases[Number(new URLSearchParams(location.search).get('case'))];
createRoot(document.getElementById('root')).render(<EventStudio initialData={item.event} user={{organizationId:fixture.organizationId}} embedded isDark/>);
