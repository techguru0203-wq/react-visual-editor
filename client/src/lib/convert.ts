import htmlToPdfmake from 'html-to-pdfmake';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import mammoth from 'mammoth'
import {DOCTYPE, User} from '@prisma/client';
import {replace, find, noop, remove, trim,isString} from 'lodash'
import {
    AlignmentType,
    HeadingLevel,
    Paragraph, ShadingType,
    Table,
    TableCell,
    TableRow,
    TextRun,
    WidthType
} from 'docx'
import {DevPlanOutput} from "../containers/devPlans/types/devPlanTypes";
import {Specialization} from "../containers/profile/types/profileTypes";
import {DocumentOutput} from "../containers/documents/types/documentTypes";

export async function convertDocxToPdf(docxBlob: Blob,lineHeight=1.5): Promise<string> {
    try {
        const reader = new FileReader();
        const arrayBufferPromise = new Promise<ArrayBuffer>((resolve, reject) => {
            reader.onloadend = () => resolve(reader.result as ArrayBuffer);
            reader.onerror = reject;
            reader.readAsArrayBuffer(docxBlob);
        });
        const docxBuffer = await arrayBufferPromise;
        const { value: html, messages } = await mammoth.convertToHtml({
            arrayBuffer: docxBuffer,
        });
        let styledHtml = html
            .replace(
                /<h1>/g,
                '<h1 style="font-size: 23px; color: black; font-weight: bold; margin-bottom: 10px;">'
            )
            .replace(
                /<h2>/g,
                `<h2 style="font-size: 18px; color: black; font-weight: bold; margin-bottom: 5px; line-height:${lineHeight};">`
            )
            .replace(
                /<h3>/g,
                `<h3 style="font-size: 12px; color: black; font-weight: bold; margin-bottom: 5px; margin-left: 15px; line-height: ${lineHeight};">`
            ) // Story: 字体设置为 16px，行间距为 1.5
            .replace(
                /<h4>/g,
                `<h4 style="font-size: 12px; color: black; font-weight: bold; margin-bottom: 5px; margin-left: 20px; line-height: 0.5;">`
            )
            .replace(
                /<p>/g,
                `<p style="font-size: 10px; margin-left: 20px; margin-bottom: 5px; line-height: ${lineHeight};">`
            ) // 普通段落字体设置为 12px，行间距为 1.5
            .replace(/<strong>/g, '<strong style="font-size: 10px;">')
            .replace(
                /<ul>/g,
                `<ul style="font-size: 10px; margin-left: 40px; list-style-type: disc; line-height: ${lineHeight};">`
            ) // 无序列表字体设置为 12px，行间距为 1.5
        const parser = new DOMParser();
        const doc = parser.parseFromString(styledHtml, 'text/html');
        const document = doc.documentElement;
        const pdfmakeContent:any = htmlToPdfmake(document.innerHTML);
        let inRange = false;
        pdfmakeContent?.forEach((content:any) => {
            if (content.nodeName === 'TABLE') {
                content.table.widths = ['25%', '30%', '50%'];
                content.table.body.forEach((row:any) => {
                    row.forEach((cell:any) => {
                        if (cell.stack) {
                            cell.stack.forEach((item:any) => {
                                if (item.nodeName === 'P') {
                                    item.margin = [0, 1, 0, 1];
                                    item.lineHeight = 1;
                                }
                            })
                        }
                    })
                })
            }
            if (content.nodeName === 'H2' && content.text === 'Team Members') {
                inRange = true;
            }
            if (inRange && content.nodeName === 'P') {
                content.margin = [15, 2, 0, 0];
                content.lineHeight = 1;
            }
            if (content.nodeName === 'H2' && content.text === 'Milestones') {
                content.marginTop = 10;
                inRange = false;
            }
        })
        pdfMake.vfs = pdfFonts.pdfMake.vfs;
        remove(pdfmakeContent, function(n:any) {
            return isString(n.text)&&trim(n.text)===''
        });
        return new Promise((resolve, reject) => {
            pdfMake.createPdf({
                content: pdfmakeContent,
                defaultStyle: {
                    // fontSize: 10,
                    // lineHeight:0.7
                    // leadingIndent: 50
                },
            }).getDataUrl((data) => {
                if (data) {
                    resolve(data);
                } else {
                    reject(new Error('Failed to generate PDF data URL'));
                }
            });
        });
    } catch (error) {
        throw error;
    }
}

export const createDevPlanDocxFile = (data:DevPlanOutput,availableUsers?:ReadonlyArray<User>) => {
    const paragraphs = []
    // 添加项目的标题
    paragraphs.push(
        new Paragraph({
            text: data.name,
            heading: HeadingLevel.HEADING_1,
            spacing: { after: 300 } // 增加标题后的空白
        })
    )

    // 添加 Roles Needed
    if (data.requiredSpecialties && data.requiredSpecialties.length > 0) {
        paragraphs.push(
            new Paragraph({
                text: 'Roles Needed',
                heading: HeadingLevel.HEADING_2,
                spacing: { after: 100 }
            })
        )
        data.requiredSpecialties.forEach(role => {
            let text
            Object.entries(Specialization).forEach(([name, value]) => {
                if(name===role)text=value
            });
            paragraphs.push(
                new Paragraph({
                    text,
                    indent: { left: 500 },
                    spacing: { after: 100 }
                })
            )
        })
    }

    // 添加 Team Members
    if (data.teamMembers && data.teamMembers.length > 0) {
        paragraphs.push(
            new Paragraph({
                text: 'Team Members',
                heading: HeadingLevel.HEADING_2,
                spacing: { after: 100 }
            })
        )
        data.teamMembers.forEach(member => {
            const user=find(availableUsers,{id:member.userId})
            let specialty
            Object.entries(Specialization).forEach(([name, value]) => {
                if(name===member.specialty)specialty=value
            });
            paragraphs.push(
                new Paragraph({
                    text: `- ${user?.username} (${specialty}, ${member.storyPointsPerSprint} pts)`,
                    indent: { left: 500 },
                    spacing: { after: 100 }
                })
            )
        })
    }

    const tableHead = (text: string) =>
        new TableCell({
            children: [
                new Paragraph({
                    text: text,
                    alignment: AlignmentType.LEFT,
                    indent: { left: 50 }
                })
            ],
            shading: {
                fill: 'D3D3D3', // 灰色背景
                type: ShadingType.CLEAR
            }
        })
    const tableRow = (text: string,size:number) =>
        new TableCell({
            children: [
                new Paragraph({
                    text: text,
                    alignment: AlignmentType.LEFT,
                    indent: { left: 50 }
                })
            ],
            width: {
                size: size,
                type: WidthType.DXA
            }
        })
    // 添加 Milestones 信息 (使用表格)
    if (data.milestones && data.milestones.length > 0) {
        paragraphs.push(
            new Paragraph({
                text: 'Milestones',
                heading: HeadingLevel.HEADING_2,
                spacing: { after: 100 }
            })
        )

        const milestoneTableRows: TableRow[] = []

        // 添加表头
        milestoneTableRows.push(
            new TableRow({
                children: [
                    tableHead('Milestone'),
                    tableHead('Start - End'),
                    tableHead('Epics')
                ]
            })
        )

        data.milestones.forEach(milestone => {
            const startDate = new Date(milestone.startDate).toLocaleDateString()
            const endDate = new Date(milestone.endDate).toLocaleDateString()
            const paragraphEpics = milestone.epics.map(epic => {
                const epicCompletionPercentage = Math.round(
                    ((epic.prevStoryPoint??0) / epic.storyPoint) * 100
                )
                return new Paragraph(
                    {
                        text:`${epic.name} - ${epicCompletionPercentage}% completion(${epic.prevStoryPoint}/${epic.storyPoint} points)`,
                        alignment: AlignmentType.LEFT,
                        indent: { left: 50 }
                    }
                )
            })

            milestoneTableRows.push(
                new TableRow({
                    children: [
                        tableRow( replace(
                            `${milestone.name}(${milestone.storyPoint} Points)`,
                            ' ',
                            ''
                        ),2300),
                        tableRow(`${startDate}-${endDate}`,2700),
                        new TableCell({
                            children: paragraphEpics,
                            width: {
                                size: 5000,
                                type: WidthType.DXA
                            }
                        })
                    ]
                })
            )
        })

        // 添加表格
        paragraphs.push(
            new Table({
                columnWidths: [2300, 2700, 5000],
                rows: milestoneTableRows,
            })
        )
    }

    // 添加 Sprint 信息 (使用表格)
    if (data.sprints && data.sprints.length > 0) {
        paragraphs.push(
            new Paragraph({
                text: 'Sprints',
                heading: HeadingLevel.HEADING_2,
                spacing: { after: 100 }
            })
        )

        const sprintTableRows: TableRow[] = []

        // 添加表头
        sprintTableRows.push(
            new TableRow({
                children: [
                    tableHead('Sprint'),
                    tableHead('Start - End'),
                    tableHead('Stories')
                ]
            })
        )

        data?.sprints?.forEach(sprint => {
            const sprintStartDate = new Date(sprint.startDate).toLocaleDateString()
            const sprintEndDate = new Date(sprint.endDate).toLocaleDateString()
            const sprintStoryPoints = sprint.storyPoint
            const paragraphStories = sprint.children.map(
                story =>
                    new Paragraph({
                        text:`Story: ${story.name} (${story.totalStoryPoint} Points)`,
                        alignment: AlignmentType.LEFT,
                        indent: { left: 50 }
                    })
            )
            sprintTableRows.push(
                new TableRow({
                    children: [
                        tableRow(replace(
                            `${sprint.name}(${sprintStoryPoints}Points)`,
                            ' ',
                            ''
                        ),2300),
                        tableRow(`${sprintStartDate}-${sprintEndDate}`,2700),
                        new TableCell({
                            children: paragraphStories,
                            width: {
                                size: 5000,
                                type: WidthType.DXA
                            }
                        })
                    ]
                })
            )
        })

        // 添加表格
        paragraphs.push(
            new Table({
                rows: sprintTableRows,
                columnWidths:[2300, 2700, 5000],
            })
        )
    }

    // 遍历每个 Epic
    data.epics.forEach(epic => {
        paragraphs.push(
            new Paragraph({
                text: `Epic: ${epic.name} (${epic.storyPoint} Points)`,
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 200, after: 200 } // 每个 Epic 前后增加空行
            })
        )

        // 遍历每个 Epic 中的 Story
        epic.children.forEach(story => {
            paragraphs.push(
                new Paragraph({
                    text: `Story: ${story.name} (${story.storyPoint} Points)`,
                    heading: HeadingLevel.HEADING_3,
                    spacing: { before: 150, after: 150 }, // 每个 Story 前后增加空行
                    indent: { left: 500 } // Story 相对 Epic 缩进
                })
            )

            // 遍历每个 Story 中的 Task
            story.children.forEach(task => {
                // Task 标题
                paragraphs.push(
                    new Paragraph({
                        text: `Task: ${task.name} (${task.storyPoint} Points)`,
                        heading: HeadingLevel.HEADING_4,
                        spacing: { before: 100, after: 100 }, // 每个 Task 前后增加空行
                        indent: { left: 1000 } // Task 相对 Story 缩进
                    })
                )

                // Task 描述
                paragraphs.push(
                    new Paragraph({
                        text: task?.description?.split?.('Acceptance Criteria:')[0]?.trim(),
                        spacing: { before: 100, after: 100 },
                        indent: { left: 1000 } // Task 描述与 Task 标题保持一致缩进
                    })
                )

                // 添加 Acceptance Criteria
                if (task?.description?.includes?.('Acceptance Criteria')) {
                    let criteria = task?.description?.split('Acceptance Criteria:')[1]
                        ?.trim()
                        .split('\n')
                        .map(c => c.trim())

                    if (criteria) {
                        // 添加 "Acceptance Criteria" 标题
                        paragraphs.push(
                            new Paragraph({
                                children: [
                                    new TextRun({
                                        text: 'Acceptance Criteria',
                                        bold: true
                                    })
                                ],
                                spacing: { before: 100, after: 50 },
                                indent: { left: 1000 }
                            })
                        )
                        // 添加每个验收标准
                        criteria.forEach(line => {
                            paragraphs.push(
                                new Paragraph({
                                    text: `• ${replace(line, '-', '')}`,
                                    spacing: { before: 50, after: 50 },
                                    indent: { left: 1200 } // 验收标准相对 Task 描述进一步缩进
                                })
                            )
                        })
                    }
                }
            })
        })
    })

    return paragraphs
}

export  function convertHTMLToParagraph({doc}: { doc: DocumentOutput | DevPlanOutput; }): (Paragraph | Table)[] {
    const container = document.createElement('div');
    const newParagraphs: (Paragraph | Table)[] = [];
    let contents =
        doc?.type === DOCTYPE.DEVELOPMENT_PLAN && 'epics' in doc
            ? doc.epics.map((epic) => epic.name).join(', ')
            : doc?.contents;
    container.innerHTML = contents as string;
    container.childNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as HTMLElement;
            switch (element.tagName) {
                case 'H1':
                    newParagraphs.push(
                        new Paragraph({
                            text: element.textContent || '',
                            heading: HeadingLevel.HEADING_1,
                        }),
                        new Paragraph({
                            text: ' ',
                        })
                    );
                    break;
                case 'H2':
                    newParagraphs.push(
                        new Paragraph({
                            text: element.textContent || '',
                            heading: HeadingLevel.HEADING_2,
                        }),
                        new Paragraph({
                            text: ' ',
                        })
                    );
                    break;
                case 'H3':
                    newParagraphs.push(
                        new Paragraph({
                            text: element.textContent || '',
                            heading: HeadingLevel.HEADING_3,
                        }),
                        new Paragraph({
                            text: ' ',
                        })
                    );
                    break;
                case 'P':
                    newParagraphs.push(
                        new Paragraph(element.textContent || ''),
                        new Paragraph({
                            text: ' ',
                        })
                    );
                    break;
                case 'UL':
                    element.querySelectorAll('li').forEach((li) => {
                        newParagraphs.push(
                            new Paragraph({
                                text: li.textContent || '',
                                bullet: { level: 0 },
                            })
                        );
                    });
                    newParagraphs.push(
                        new Paragraph({
                            text: ' ',
                        })
                    );
                    break;
                case 'OL':
                    element.querySelectorAll('li').forEach((li, index) => {
                        newParagraphs.push(
                            new Paragraph({
                                text: li.textContent || '',
                                numbering: {
                                    reference: 'ordered-list',
                                    level: 0,
                                },
                            })
                        );
                    });
                    newParagraphs.push(
                        new Paragraph({
                            text: ' ',
                        })
                    );
                    break;
                case 'TABLE':
                    const rows: TableRow[] = [];
                    let columnCount = 0;
                    element.querySelectorAll('tr').forEach((tr) => {
                        const cells: TableCell[] = [];
                        tr.querySelectorAll('td, th').forEach((td) => {
                            const isHeader = td.tagName === 'TH';
                            cells.push(
                                new TableCell({
                                    children: [
                                        new Paragraph({
                                            children: [
                                                new TextRun({
                                                    text: td.textContent || '',
                                                    bold: isHeader,
                                                }),
                                            ],
                                        }),
                                    ],
                                    width: {
                                        size: 100 / tr.children.length,
                                        type: WidthType.PERCENTAGE,
                                    },
                                    shading: isHeader
                                        ? {
                                            fill: 'd3d3d3',
                                        }
                                        : undefined,
                                })
                            );
                        });
                        rows.push(new TableRow({ children: cells }));
                        columnCount = cells.length;
                    });
                    newParagraphs.push(
                        new Table({
                            rows: rows,
                            columnWidths: Array(columnCount).fill(
                                Math.floor(9638 / columnCount)
                            ),
                            width: {
                                size: 100,
                                type: WidthType.PERCENTAGE,
                            },
                        }),
                        new Paragraph({
                            text: ' ',
                        })
                    );
                    break;
                case 'PRE':
                    newParagraphs.push(
                        new Paragraph({
                            children: [
                                new TextRun({
                                    text: element.textContent || '',
                                    font: 'Courier New',
                                }),
                            ],
                            alignment: AlignmentType.LEFT,
                        }),
                        new Paragraph({
                            text: ' ',
                        })
                    );
                    break;
                case 'TITLE': // ignore title tag
                    noop();
                    break;
                default:
                    newParagraphs.push(new Paragraph(element.textContent || ''));
                    break;
            }
        }
    });
    return newParagraphs;
}