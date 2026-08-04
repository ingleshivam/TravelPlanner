# Current array - [12,8,9,3,11,5,4]

left  = [8,9,12]
right = [3,4,5,11] 


def merge_array(left,right):
    i,j = 0,0 # 
    m,n = len(left),len(right) #3,4
    result = []
    while i <m and j<n: # 0 <= 3 and 0 <=4 = T, 0 <=3 and 1<=4=T, 0<=3 and 2<=4 = T,  0<=3 and 3<=4 = T, 1<=3 and 3<=4 = T, 2 <=3 and 3<=4 = T, 2<=3 and 4<=4 = T
        if left[i] <= right[j]: # 8 <=3 = F,8 <= 4 = F, 8 <= 5 = F, 8 <= 11 = T, 9 <= 11 = T, 12 <=11 = F, 12 <=
            result.append(left[i]) # 3,4,5,8,9,
            i+=1 # 1,2
        else:
            result.append(right[j]) # 3,4,5,8,9,11,
            j+=1 # 1,2,3,4
    
    if i<m:
        while i < m:
            result.append(left[i])
            i+=1
    if j<n:
        while j<n:
            result.append(right[j])
            j+=1
    return result

def merge_sort(arr):
    if len(arr)<=1:
        return arr

    mid = len(arr)//2
    left_arr = arr[:mid]
    right_arr = arr[mid:]
    left = merge_sort(left_arr)
    right =  merge_sort(right_arr)
    return merge_array(left,right)


arr =[12,8,9,3,11,5,4]
print(merge_sort(arr))