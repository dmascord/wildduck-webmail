'use strict';

const tools = require('../../lib/tools');

module.exports = {
    id: 'examplePlugin',
    title: 'Example Plugin',
    view: 'example-plugin',
    order: 100,
    getValues({ user }) {
        let meta = (user && user.metaData) || {};
        return {
            enabled: meta.exampleEnabled !== undefined ? meta.exampleEnabled : false
        };
    },
    schema(Joi) {
        return Joi.object().keys({
            enabled: tools.booleanSchema.default(false)
        });
    },
    apply({ values }) {
        return {
            metaData: {
                exampleEnabled: values.enabled
            }
        };
    },
    registerRoutes(router) {
        router.post('/example-plugin/action', (req, res) => {
            req.flash('success', 'Example action executed');
            res.redirect('/account/profile/');
        });
    }
};
