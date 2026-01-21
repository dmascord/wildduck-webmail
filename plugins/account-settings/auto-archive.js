'use strict';

const tools = require('../../lib/tools');
const autoArchive = require('../../lib/auto-archive');

module.exports = {
    id: 'autoArchive',
    title: 'Auto-Archive',
    view: 'account-plugins/auto-archive',
    order: 50,
    getValues({ user }) {
        let meta = (user && user.metaData) || {};
        let defaults = autoArchive.getDefaults();
        return {
            autoArchiveEnabled: meta.autoArchiveEnabled !== undefined ? meta.autoArchiveEnabled : true,
            autoArchiveMonths: meta.autoArchiveMonths || defaults.months,
            autoArchiveBase: meta.autoArchiveBase || defaults.base,
            autoArchivePattern: meta.autoArchivePattern || defaults.pattern
        };
    },
    schema(Joi) {
        return Joi.object().keys({
            autoArchiveEnabled: tools.booleanSchema.default(true),
            autoArchiveMonths: Joi.number().integer().min(1).max(120).required(),
            autoArchiveBase: Joi.string().trim().min(1).max(255).required(),
            autoArchivePattern: Joi.string().trim().min(1).max(255).required()
        });
    },
    apply({ values }) {
        return {
            metaData: {
                autoArchiveEnabled: values.autoArchiveEnabled,
                autoArchiveMonths: values.autoArchiveMonths,
                autoArchiveBase: values.autoArchiveBase,
                autoArchivePattern: values.autoArchivePattern
            }
        };
    },
    registerRoutes(router, deps) {
        router.post('/auto-archive/run', async (req, res) => {
            try {
                let userData = await deps.getUserWithMeta(req.user);
                let result = await deps.runAutoArchive(userData);
                req.flash('success', `Auto-archive run completed (${result.scheduled} batch(es) scheduled).`);
            } catch (err) {
                req.flash('danger', err.message || 'Auto-archive run failed');
            }
            res.redirect('/account/profile/');
        });
    }
};
