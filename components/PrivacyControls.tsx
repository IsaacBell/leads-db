import React from 'react';
import Script from 'next/script';

const PrivacyControls = () => {
  return (
    <>
      <Script
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            var _iub = _iub || [];
            _iub.csConfiguration = {
              askConsentAtCookiePolicyUpdate: true,
              enableFadp: true,
              enableLgpd: true,
              enableUspr: true,
              fadpApplies: true,
              floatingPreferencesButtonDisplay: "bottom-right",
              lang: "en",
              perPurposeConsent: true,
              siteId: 3576699,
              usprApplies: true,
              whitelabel: false,
              gdprAppliesGlobally: false,
              cookiePolicyId: 20803775,
              banner: {
                acceptButtonDisplay: true,
                closeButtonDisplay: false,
                customizeButtonDisplay: true,
                explicitWithdrawal: true,
                listPurposes: true,
                position: "float-top-center",
                rejectButtonDisplay: true,
                showTitle: false
              }
            };
          `,
        }}
      />
      <Script
        strategy="afterInteractive"
        src="https://cs.iubenda.com/autoblocking/3576699.js"
      />
      <Script
        strategy="afterInteractive"
        src="//cdn.iubenda.com/cs/gpp/stub.js"
      />
      <Script
        strategy="afterInteractive"
        src="//cdn.iubenda.com/cs/iubenda_cs.js"
        charset="UTF-8"
        async
      />
    </>
  );
};

export default PrivacyControls;