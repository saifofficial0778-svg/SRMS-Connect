const catchAsync = require("../../utils/catchAsync");
const SearchService = require("./search.service");

const SearchController = {

    search: catchAsync(async (req, res) => {
        const { userId, role } = req.user;

        const data = await SearchService.search(userId, req.validatedQuery, role);

        return res.status(200).json({
            success: true,
            data
        });
    }),

    getFilters: catchAsync(async (req, res) => {
        const data = await SearchService.getFilterOptions();

        return res.status(200).json({
            success: true,
            data
        });
    }),

};

module.exports = SearchController;
