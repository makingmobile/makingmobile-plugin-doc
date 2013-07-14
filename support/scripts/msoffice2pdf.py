#!/usr/bin/env python

"""
Convert word/excel/powerpoint document to pdf.
Need Microsoft Office(2007+) and pywin32 lib.

Return sys.exit(0) when success
Return sys.exit(1) when pass in wrong params
Return sys.exit(2) when error during converting
Return sys.exit(3) when pass in a unsupported document type
"""
import sys
import os
import win32com.client, time, pythoncom

WORD_DOCTYPE = ['txt', 'docx', 'docm', 'doc', 'odt', 'mht']
EXCEL_DOCTYPE = ['xlsx', 'xls', 'xlw', 'ods']
POWERPOINT_DOCTYPE = ['ppt', 'pptx', 'pptm', 'ppsx', 'pps', 'odp']

wdFormatPDF = 17
xlTypePDF = 0
ppSaveAspdf = 32

def convertWord(ifile, ofile):
    word = win32com.client.Dispatch('Word.Application')
    word.Visible = False
    word.DisplayAlerts = False
    doc = word.Documents.Open(ifile)
    doc.SaveAs(ofile, wdFormatPDF)
    doc.Close()
    word.Quit()
    
# Attention: it will show a "publishing..." window during converting
def convertExcel(ifile, ofile):
    excel = win32com.client.Dispatch('Excel.Application')
    excel.Visible = False
    excel.DisplayAlerts = False
    elx = excel.Workbooks.Open(ifile)
    elx.ExportAsFixedFormat(xlTypePDF, ofile, 0, True, True)
    elx.Close()
    excel.Quit()

# Attention: it will show a "publishing..." window during converting
def convertPowerpoint(ifile, ofile):
    powerPoint = win32com.client.Dispatch('Powerpoint.Application')
    #win32com.client.gencache.EnsureDispatch('Powerpoint.Application')
    powerPoint.DisplayAlerts = False
    ppt = powerPoint.Presentations.Open(ifile, False, False, False)
    ppt.SaveAs(ofile, ppSaveAspdf)
    ppt.Close()
    powerPoint.Quit()





### Main entrance
if __name__ == '__main__':
    
    if  len(sys.argv) != 4 or \
        sys.argv[1] != '-o' or \
        sys.argv[2].rfind('.pdf') == -1 or \
        sys.argv[3].find('.') == -1:
        print "\nError Args!\nUsage: " + sys.argv[0] + ' -o output.pdf input.doc'
        sys.exit(1)
    
    doctype = sys.argv[3].split('.')[-1]
    
    try:
        if doctype in WORD_DOCTYPE:
            convertWord(sys.argv[3], sys.argv[2])
        elif doctype in EXCEL_DOCTYPE:
            convertExcel(sys.argv[3], sys.argv[2])
        elif doctype in POWERPOINT_DOCTYPE:
            convertPowerpoint(sys.argv[3], sys.argv[2])
        else:
            print 'msoffice2pdf: Error doc type'
            sys.exit(3)
            
    except Exception, e:
        print 'mspffice2pdf: ' + str(e)
        sys.exit(2)
        
    if not os.path.exists(sys.argv[2]):
        time.sleep(2)
    if not os.path.exists(sys.argv[2]):
        print 'msoffice2pdf: Cannot found output pdf file'
        sys.exit(2)
    else:
        sys.exit(0)
    
    
    
            