const Render = require('../models/render.model');

exports.updateRender = async (req, res) => {
  const { id } = req.params;
  const { items = [] } = req.body;


  try {
    const updatedRender = await Render.findByIdAndUpdate(
      id,
      { items },
      { new: true, runValidators: true }
    );

    if (!updatedRender) {
      return res.status(404).json({ message: 'ההדמיה לא נמצאה' });
    }

    return res.status(200).json({
      id: updatedRender._id,
      items: updatedRender.items
    });
  } catch (error) {
    return res.status(500).json({ message: 'שגיאת שרת בעדכון ההדמיה', error: error.message });
  }
};


