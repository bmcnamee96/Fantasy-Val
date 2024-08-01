// controllers/draftController.js

exports.updateDraftStatus = async (req, res) => {
    const { leagueId } = req.params;
    const { currentTurnIndex, draftStarted, draftEnded } = req.body;

    // Perform necessary operations, e.g., update database

    return res.status(200).json({ message: 'Draft status updated successfully' });
};
