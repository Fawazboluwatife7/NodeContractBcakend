"use strict";

const DocUtils = require("docxtemplater").DocUtils;
function isNaN(number) {
	return !(number === number);
}

const ImgManager = require("./imgManager");
const moduleName = "open-xml-templating/docxtemplater-image-module";

function getInner({part}) {
	return part;
}

class ImageModule {
	constructor(options) {
		this.options = options || {};
		if (this.options.centered == null) { this.options.centered = false; }
		if (this.options.getImage == null) { throw new Error("You should pass getImage"); }
		if (this.options.getSize == null) { throw new Error("You should pass getSize"); }
		this.qrQueue = [];
		this.imageNumber = 1;
	}
	optionsTransformer(options, docxtemplater) {
		const relsFiles = docxtemplater.zip.file(/\.xml\.rels/)
			.concat(docxtemplater.zip.file(/\[Content_Types\].xml/))
			.map((file) => file.name);
		this.fileTypeConfig = docxtemplater.fileTypeConfig;
		this.zip = docxtemplater.zip;
		options.xmlFileNames = options.xmlFileNames.concat(relsFiles);
		return options;
	}
	set(options) {
		if (options.zip) {
			this.zip = options.zip;
		}
		if (options.xmlDocuments) {
			this.xmlDocuments = options.xmlDocuments;
		}
	}
	parse(placeHolderContent) {
		const module = moduleName;
		const type = "placeholder";
		if (placeHolderContent[0] === "%") {
			return {type, value: placeHolderContent.substr(1), module};
		}
		return null;
	}
	postparse(parsed) {
		const expandTo = this.options.centered ? "w:p" : "w:t";
		return DocUtils.traits.expandToOne(parsed, {moduleName, getInner, expandTo});
	}
	render(part, options) {
		this.imgManager = new ImgManager(this.zip, options.filePath, this.xmlDocuments);
		if (!part.type === "placeholder" || part.module !== moduleName) {
			return null;
		}
		const tagValue = options.scopeManager.getValue(part.value);

		const tagXml = this.fileTypeConfig.tagTextXml;

		if (tagValue == null) {
			return {value: tagXml};
		}

		let imgBuffer;
		try {
			imgBuffer = this.options.getImage(tagValue, part.value);
		}
		catch (e) {
			return {value: tagXml};
		}
		const rId = this.imgManager.addImageRels(this.getNextImageName(), imgBuffer);
		const sizePixel = this.options.getSize(imgBuffer, tagValue, part.value);
		const size = [this.convertPixelsToEmus(sizePixel[0]), this.convertPixelsToEmus(sizePixel[1])];
		const newText = this.options.centered ? this.getImageXmlCentered(rId, size) : this.getImageXml(rId, size);
		return {value: newText};
	}
	getNextImageName() {
		const name = `image_generated_${this.imageNumber}.png`;
		this.imageNumber++;
		return name;
	}
	convertPixelsToEmus(pixel) {
		return Math.round(pixel * 9525);
	}
	getImageXml(rId, size) {
		if (isNaN(rId)) {
			throw new Error("rId is NaN, aborting");
		}
		return `<w:drawing>
		<wp:inline distT="0" distB="0" distL="0" distR="0">
			<wp:extent cx="${size[0]}" cy="${size[1]}"/>
			<wp:effectExtent l="0" t="0" r="0" b="0"/>
			<wp:docPr id="2" name="Image 2" descr="image"/>
			<wp:cNvGraphicFramePr>
				<a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/>
			</wp:cNvGraphicFramePr>
			<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
				<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
					<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
						<pic:nvPicPr>
							<pic:cNvPr id="0" name="Picture 1" descr="image"/>
							<pic:cNvPicPr>
								<a:picLocks noChangeAspect="1" noChangeArrowheads="1"/>
							</pic:cNvPicPr>
						</pic:nvPicPr>
						<pic:blipFill>
							<a:blip r:embed="rId${rId}">
								<a:extLst>
									<a:ext uri="{28A0092B-C50C-407E-A947-70E740481C1C}">
										<a14:useLocalDpi xmlns:a14="http://schemas.microsoft.com/office/drawing/2010/main" val="0"/>
									</a:ext>
								</a:extLst>
							</a:blip>
							<a:srcRect/>
							<a:stretch>
								<a:fillRect/>
							</a:stretch>
						</pic:blipFill>
						<pic:spPr bwMode="auto">
							<a:xfrm>
								<a:off x="0" y="0"/>
								<a:ext cx="${size[0]}" cy="${size[1]}"/>
							</a:xfrm>
							<a:prstGeom prst="rect">
								<a:avLst/>
							</a:prstGeom>
							<a:noFill/>
							<a:ln>
								<a:noFill/>
							</a:ln>
						</pic:spPr>
					</pic:pic>
				</a:graphicData>
			</a:graphic>
		</wp:inline>
	</w:drawing>
		`.replace(/\t|\n/g, "");
	}
	getImageXmlCentered(rId, size) {
		if (isNaN(rId)) {
			throw new Error("rId is NaN, aborting");
		}
		return `<w:p>
			<w:pPr>
				<w:jc w:val="center"/>
			</w:pPr>
			<w:r>
				<w:rPr/>
				<w:drawing>
					<wp:inline distT="0" distB="0" distL="0" distR="0">
					<wp:extent cx="${size[0]}" cy="${size[1]}"/>
					<wp:docPr id="0" name="Picture" descr=""/>
					<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
						<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
						<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
							<pic:nvPicPr>
							<pic:cNvPr id="0" name="Picture" descr=""/>
							<pic:cNvPicPr>
								<a:picLocks noChangeAspect="1" noChangeArrowheads="1"/>
							</pic:cNvPicPr>
							</pic:nvPicPr>
							<pic:blipFill>
							<a:blip r:embed="rId${rId}"/>
							<a:stretch>
								<a:fillRect/>
							</a:stretch>
							</pic:blipFill>
							<pic:spPr bwMode="auto">
							<a:xfrm>
								<a:off x="0" y="0"/>
								<a:ext cx="${size[0]}" cy="${size[1]}"/>
							</a:xfrm>
							<a:prstGeom prst="rect">
								<a:avLst/>
							</a:prstGeom>
							<a:noFill/>
							<a:ln w="9525">
								<a:noFill/>
								<a:miter lim="800000"/>
								<a:headEnd/>
								<a:tailEnd/>
							</a:ln>
							</pic:spPr>
						</pic:pic>
						</a:graphicData>
					</a:graphic>
					</wp:inline>
				</w:drawing>
			</w:r>
		</w:p>
		`.replace(/\t|\n/g, "");
	}
}

module.exports = ImageModule;
