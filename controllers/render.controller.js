exports.updateRender = async (req, res) => {

    const id = req.params.id;
    const items = req.body.items;

    try { 
        const updatedRender = await Render.findOneAndUpdate({ _id: id }, { items: items }, { new: true });
        if (!updatedRender) {
            return res.status(404).json({ message: "ההדמיה לא נמצאה" });
        }
        res.status(200).json({
        id: updatedRender._id,
        items: updatedRender.items
    });
    }

   catch (error) {
    res.status(500).json({ message: "שגיאת שרת בעדכון ההדמיה", error: error.message });
   }

}


